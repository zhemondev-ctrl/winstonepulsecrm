CREATE TABLE public.self_lead_attribution (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id),
  collector_id uuid NOT NULL REFERENCES public.profiles(id),
  receipt_id uuid REFERENCES public.agent_lead_receipts(id),
  evidence text NOT NULL CHECK (evidence IN ('receipt','legacy_audit')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.self_lead_attribution TO service_role;
ALTER TABLE public.self_lead_attribution ENABLE ROW LEVEL SECURITY;
CREATE INDEX self_lead_attribution_collector ON public.self_lead_attribution(collector_id, created_at);
CREATE TRIGGER self_lead_attribution_immutable BEFORE UPDATE OR DELETE ON public.self_lead_attribution
  FOR EACH ROW EXECUTE FUNCTION public.append_only_block();
COMMENT ON TABLE public.self_lead_attribution IS 'Immutable collector of each self-collected lead (owner 2026-11-14). Server-only.';

INSERT INTO public.self_lead_attribution(lead_id,collector_id,receipt_id,evidence)
SELECT r.lead_id, r.agent_id, r.id, 'receipt' FROM public.agent_lead_receipts r ON CONFLICT DO NOTHING;
INSERT INTO public.self_lead_attribution(lead_id,collector_id,evidence)
SELECT DISTINCT ON (l.id) l.id, a.actor_profile_id, 'legacy_audit'
FROM public.leads l JOIN public.audit_logs a ON a.entity_id = l.id::text AND a.action = 'lead_created' AND a.actor_profile_id IS NOT NULL
JOIN public.profiles p ON p.id = a.actor_profile_id
WHERE l.assignment_source = 'self'
ORDER BY l.id, a.created_at ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_daily_lead_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  owner uuid := COALESCE(NEW.assigned_to, NEW.assigned_agent_id);
  old_owner uuid;
  d date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  day_start timestamptz := ((now() AT TIME ZONE 'Asia/Dhaka')::date)::timestamp AT TIME ZONE 'Asia/Dhaka';
  n integer;
BEGIN
  IF owner IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.assignment_source = 'self' AND NEW.source = 'agent_app' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('self:' || owner::text || ':' || d::text, 0));
    SELECT count(*) INTO n FROM public.leads
      WHERE COALESCE(assigned_to, assigned_agent_id) = owner
        AND assignment_source = 'self' AND source = 'agent_app'
        AND created_at >= day_start;
    IF n >= 10 THEN
      RAISE EXCEPTION 'Daily self lead cap reached: 10 self-collected leads per agent per Dhaka day' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  -- Owner rule 2026-11-14: a self-collected lead (attribution row) never uses one
  -- of the 50 company slots, even when LeadHub routes it later.
  IF EXISTS (SELECT 1 FROM public.self_lead_attribution WHERE lead_id = NEW.id) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    old_owner := COALESCE(OLD.assigned_to, OLD.assigned_agent_id);
    IF old_owner IS NOT DISTINCT FROM owner THEN RETURN NEW; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(owner::text || ':' || d::text, 0));
  IF EXISTS (SELECT 1 FROM public.lead_daily_assignment_ledger
             WHERE agent_id = owner AND work_date = d AND lead_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO n FROM public.lead_daily_assignment_ledger WHERE agent_id = owner AND work_date = d;
  IF n >= 50 THEN
    RAISE EXCEPTION 'Daily lead cap reached: 50 company leads per agent per Dhaka day' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.lead_daily_assignment_ledger (agent_id, work_date, lead_id)
  VALUES (owner, d, NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.submit_collected_leads_atomic(_agent uuid, _request uuid, _rows jsonb, _draft uuid DEFAULT NULL::uuid, _revision integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d date := (now() AT TIME ZONE 'Asia/Dhaka')::date; used integer; needed integer:=0;
  row jsonb; phone text; matched uuid; lead uuid; receipt uuid; idx integer:=0;
  prepared jsonb:='[]'; results jsonb:='[]'; result jsonb; saved public.agent_lead_submission_requests%ROWTYPE;
  hash text; draft public.agent_lead_drafts%ROWTYPE;
BEGIN
  PERFORM public.collection_require_agent(_agent,true);
  IF _request IS NULL OR jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows)<1 OR jsonb_array_length(_rows)>1000 THEN RAISE EXCEPTION 'Invalid submission'; END IF;
  hash:=md5(_rows::text||coalesce(_draft::text,'')||coalesce(_revision::text,''));
  PERFORM pg_advisory_xact_lock(hashtextextended('collection:'||_agent::text||':'||d::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('collection-request:'||_agent::text||':'||_request::text,0));
  SELECT * INTO saved FROM public.agent_lead_submission_requests WHERE agent_id=_agent AND request_key=_request;
  IF FOUND THEN IF saved.payload_hash<>hash THEN RAISE EXCEPTION 'Submission key changed'; END IF; RETURN saved.result; END IF;
  IF _draft IS NOT NULL THEN
    SELECT * INTO draft FROM public.agent_lead_drafts WHERE id=_draft FOR UPDATE;
    IF NOT FOUND OR draft.agent_id<>_agent OR draft.submitted_at IS NOT NULL OR draft.revision IS DISTINCT FROM _revision OR jsonb_array_length(_rows)<>1 THEN RAISE EXCEPTION 'Draft changed; reload before submitting'; END IF;
  END IF;
  FOR phone IN SELECT DISTINCT p FROM jsonb_array_elements(_rows) x CROSS JOIN LATERAL public.extract_bd_phones(x->>'phoneNumber') p ORDER BY p LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('collection-phone:'||phone,0));
  END LOOP;
  FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    IF length(trim(coalesce(row->>'name','')))=0 OR length(row->>'name')>120 THEN RAISE EXCEPTION 'Valid customer name required'; END IF;
    IF length(coalesce(row->>'notes',''))>2000 OR length(coalesce(row->>'address',''))>300 OR length(coalesce(row->>'company',''))>120 OR length(coalesce(row->>'referenceBy',''))>120 OR length(coalesce(row->>'serialNo',''))>40 THEN RAISE EXCEPTION 'Lead details too long'; END IF;
    SELECT canonical_phones[1],existing_lead_id INTO phone,matched FROM public.lead_phone_status(row->>'phoneNumber');
    IF phone IS NULL THEN RAISE EXCEPTION 'Invalid phone number'; END IF;
    IF matched IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(prepared) x WHERE x->>'phone'=phone AND x->>'duplicate'='false') THEN needed:=needed+1; END IF;
    prepared:=prepared||jsonb_build_array(jsonb_build_object('fields',row,'phone',phone,'duplicate',matched IS NOT NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(prepared) x WHERE x->>'phone'=phone)));
  END LOOP;
  SELECT count(*) INTO used FROM public.agent_lead_receipts WHERE agent_id=_agent AND work_day=d;
  IF used+needed>10 THEN RAISE EXCEPTION 'Daily self lead cap reached: 10 per agent per Dhaka day'; END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(prepared) LOOP
    idx:=idx+1; phone:=row->>'phone';
    IF (row->>'duplicate')::boolean THEN
      results:=results||jsonb_build_array(jsonb_build_object('index',idx-1,'status','duplicate','receiptId',NULL)); CONTINUE;
    END IF;
    BEGIN
      INSERT INTO public.leads(name,phone_number,company,notes,address,serial_no,work_date,reference_by,source,status,assigned_to,assigned_agent_id,assignment_source)
      VALUES(trim(row->'fields'->>'name'),CASE WHEN phone LIKE '880%' THEN phone ELSE '+'||phone END,nullif(trim(row->'fields'->>'company'),''),nullif(trim(row->'fields'->>'notes'),''),nullif(trim(row->'fields'->>'address'),''),
        coalesce(nullif(trim(row->'fields'->>'serialNo'),''),'LC-'||left(_request::text,8)||'-'||idx::text),d,nullif(trim(row->'fields'->>'referenceBy'),''),'agent_app','pending',NULL,NULL,NULL) RETURNING id INTO lead;
    EXCEPTION WHEN unique_violation THEN
      SELECT existing_lead_id INTO matched FROM public.lead_phone_status(CASE WHEN phone LIKE '880%' THEN phone ELSE '+'||phone END);
      IF matched IS NULL THEN RAISE; END IF;
      results:=results||jsonb_build_array(jsonb_build_object('index',idx-1,'status','duplicate','receiptId',NULL)); CONTINUE;
    END;
    INSERT INTO public.agent_lead_receipts(agent_id,lead_id,request_key,row_index,work_day) VALUES(_agent,lead,_request,idx-1,d) RETURNING id INTO receipt;
    INSERT INTO public.self_lead_attribution(lead_id,collector_id,receipt_id,evidence) VALUES(lead,_agent,receipt,'receipt');
    INSERT INTO public.audit_logs(action,entity_type,entity_id,actor_profile_id,metadata) VALUES('lead_created','lead',lead::text,_agent,jsonb_build_object('source','agent_app','receiptId',receipt,'routing','leadhub_nexus'));
    results:=results||jsonb_build_array(jsonb_build_object('index',idx-1,'status','accepted','receiptId',receipt));
  END LOOP;
  IF _draft IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(results) x WHERE x->>'status'='accepted') THEN
    UPDATE public.agent_lead_drafts SET submitted_at=now(),updated_at=now(),revision=revision+1 WHERE id=_draft;
  END IF;
  result:=jsonb_build_object('results',results,'today',d,'limit',10,'used',(SELECT count(*) FROM public.agent_lead_receipts WHERE agent_id=_agent AND work_day=d));
  INSERT INTO public.agent_lead_submission_requests(agent_id,request_key,payload_hash,result) VALUES(_agent,_request,hash,result);
  RETURN result;
END $function$;

-- LeadHub routing of collected leads: back to the collector, never via the 50 ledger.
CREATE OR REPLACE FUNCTION public.route_collected_leads(_actor_label text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; r record; d date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
  FOR r IN SELECT a.lead_id, a.collector_id FROM public.self_lead_attribution a
           JOIN public.leads l ON l.id = a.lead_id
           JOIN public.profiles p ON p.id = a.collector_id AND p.is_active
           WHERE l.assigned_to IS NULL AND l.assigned_agent_id IS NULL
             AND (l.assignment_source IS NULL OR l.assignment_source <> 'duplicate_skipped')
           FOR UPDATE OF l SKIP LOCKED LOOP
    UPDATE public.leads SET assigned_to = r.collector_id, assigned_agent_id = r.collector_id,
      assignment_source = 'self_collected', work_date = d
      WHERE id = r.lead_id AND assigned_to IS NULL AND assigned_agent_id IS NULL;
    IF FOUND THEN
      INSERT INTO public.lead_assignments(lead_id, from_agent_id, to_agent_id, source, note)
      VALUES (r.lead_id, NULL, r.collector_id, 'self_collected', 'Own lead routed to collector — ' || left(coalesce(_actor_label,'LeadHub'),80));
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END $$;

-- Executive HQ reroute: reason required, attribution never changes, audited.
CREATE OR REPLACE FUNCTION public.reroute_self_lead(_lead uuid, _to uuid, _reason text, _actor_label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev uuid;
BEGIN
  IF length(trim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'Reroute reason required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.self_lead_attribution WHERE lead_id = _lead) THEN RAISE EXCEPTION 'Not a self-collected lead'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _to AND is_active) THEN RAISE EXCEPTION 'Target agent not active'; END IF;
  SELECT coalesce(assigned_to, assigned_agent_id) INTO prev FROM public.leads WHERE id = _lead FOR UPDATE;
  UPDATE public.leads SET assigned_to = _to, assigned_agent_id = _to, assignment_source = 'self_collected' WHERE id = _lead;
  INSERT INTO public.lead_assignments(lead_id, from_agent_id, to_agent_id, source, note)
  VALUES (_lead, prev, _to, 'self_reroute_hq', left(trim(_reason),500));
  INSERT INTO public.audit_logs(action, entity_type, entity_id, metadata)
  VALUES ('self_lead_rerouted', 'lead', _lead::text, jsonb_build_object('from', prev, 'to', _to, 'reason', left(trim(_reason),500), 'by', left(coalesce(_actor_label,''),80)));
END $$;

REVOKE ALL ON FUNCTION public.route_collected_leads(text), public.reroute_self_lead(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_collected_leads(text), public.reroute_self_lead(uuid,uuid,text,text) TO service_role;