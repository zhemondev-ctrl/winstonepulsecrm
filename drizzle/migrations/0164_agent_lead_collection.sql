-- Applied 2026-11-14 with owner approval after the 13 Nov nightly backup.
-- No existing customer row, ownership, report or history is changed.

CREATE TABLE public.agent_lead_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id),
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
GRANT ALL ON public.agent_lead_drafts TO service_role;
ALTER TABLE public.agent_lead_drafts ENABLE ROW LEVEL SECURITY;
CREATE INDEX agent_lead_drafts_agent_updated ON public.agent_lead_drafts(agent_id, updated_at DESC, id) WHERE submitted_at IS NULL;

CREATE TABLE public.agent_lead_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id),
  request_key uuid NOT NULL,
  row_index integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  work_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  UNIQUE(agent_id, request_key, row_index)
);
GRANT ALL ON public.agent_lead_receipts TO service_role;
ALTER TABLE public.agent_lead_receipts ENABLE ROW LEVEL SECURITY;
CREATE INDEX agent_lead_receipts_agent_day ON public.agent_lead_receipts(agent_id, work_day, accepted_at DESC, id);
CREATE INDEX agent_lead_receipts_agent_time ON public.agent_lead_receipts(agent_id, accepted_at DESC, id);

CREATE TABLE public.agent_lead_submission_requests (
  agent_id uuid NOT NULL REFERENCES public.profiles(id),
  request_key uuid NOT NULL,
  payload_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(agent_id, request_key)
);
GRANT ALL ON public.agent_lead_submission_requests TO service_role;
ALTER TABLE public.agent_lead_submission_requests ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.agent_lead_collection_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Collection history is append-only'; END $$;
CREATE TRIGGER agent_lead_receipts_immutable BEFORE UPDATE OR DELETE ON public.agent_lead_receipts FOR EACH ROW EXECUTE FUNCTION public.agent_lead_collection_append_only();
CREATE TRIGGER agent_lead_requests_immutable BEFORE UPDATE OR DELETE ON public.agent_lead_submission_requests FOR EACH ROW EXECUTE FUNCTION public.agent_lead_collection_append_only();

CREATE FUNCTION public.collection_require_agent(_agent uuid, _mutation boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.user_id
                WHERE p.id=_agent AND p.is_active AND p.approval_status='approved' AND r.role IN ('agent','admin','team_leader')) THEN
    RAISE EXCEPTION 'Approved staff account required';
  END IF;
  IF _mutation AND (now() AT TIME ZONE 'Asia/Dhaka')::time >= time '09:05'
     AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.user_id WHERE p.id=_agent AND r.role='agent')
     AND NOT EXISTS(SELECT 1 FROM public.agent_briefing_acknowledgements
                    WHERE agent_id=_agent AND business_date=(now() AT TIME ZONE 'Asia/Dhaka')::date
                      AND policy_version='2026-09-30-v1') THEN
    RAISE EXCEPTION 'Daily briefing acknowledgement required';
  END IF;
END $$;

CREATE FUNCTION public.read_agent_lead_collection(_agent uuid, _mode text DEFAULT 'receipts', _query text DEFAULT '', _from date DEFAULT NULL, _to date DEFAULT NULL, _offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb; d date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
  PERFORM public.collection_require_agent(_agent);
  IF _offset<0 OR _offset>50000 OR _mode NOT IN ('drafts','receipts','assigned') OR length(_query)>120 OR (_from IS NOT NULL AND _to IS NOT NULL AND _from>_to) THEN RAISE EXCEPTION 'Invalid collection filters'; END IF;
  WITH matched AS (
    SELECT r.id, r.accepted_at,
      CASE WHEN l.assigned_to IS NOT NULL AND l.assigned_agent_id IS NOT NULL AND l.assigned_to<>l.assigned_agent_id THEN 'unavailable'
           WHEN coalesce(l.assigned_to,l.assigned_agent_id)=_agent THEN 'assigned_to_me'
           WHEN l.id IS NOT NULL AND l.assigned_to IS NULL AND l.assigned_agent_id IS NULL THEN 'awaiting_leadhub'
           ELSE 'unavailable' END state,
      CASE WHEN coalesce(l.assigned_to,l.assigned_agent_id)=_agent AND (l.assigned_to IS NULL OR l.assigned_agent_id IS NULL OR l.assigned_to=l.assigned_agent_id)
           THEN jsonb_build_object('id',l.id,'name',l.name,'phone',l.phone_number,'status',l.status,'source',l.source) ELSE NULL END lead
    FROM public.agent_lead_receipts r LEFT JOIN public.leads l ON l.id=r.lead_id
    WHERE r.agent_id=_agent AND (_from IS NULL OR r.work_day>=_from) AND (_to IS NULL OR r.work_day<=_to)
      AND (_query='' OR ('LC-'||upper(left(r.id::text,8))) ILIKE '%'||_query||'%'
           OR (coalesce(l.assigned_to,l.assigned_agent_id)=_agent AND (l.assigned_to IS NULL OR l.assigned_agent_id IS NULL OR l.assigned_to=l.assigned_agent_id)
               AND (l.name ILIKE '%'||_query||'%' OR l.phone_number ILIKE '%'||_query||'%')))
  ), selected AS (SELECT * FROM matched WHERE _mode<>'assigned' OR state='assigned_to_me' ORDER BY accepted_at DESC,id LIMIT 26 OFFSET _offset)
  SELECT jsonb_build_object('ready',true,'today',d,'used',(SELECT count(*) FROM public.agent_lead_receipts WHERE agent_id=_agent AND work_day=d),'limit',10,
    'receipts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'reference','LC-'||upper(left(s.id::text,8)),'acceptedAt',s.accepted_at,'state',s.state,'lead',s.lead) ORDER BY s.accepted_at DESC,s.id) FROM (SELECT * FROM selected LIMIT 25) s),'[]'::jsonb),
    'hasMore',(SELECT count(*)>25 FROM selected),
    'drafts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'revision',x.revision,'updatedAt',x.updated_at,'fields',x.fields) ORDER BY x.updated_at DESC,x.id)
       FROM (SELECT * FROM public.agent_lead_drafts WHERE agent_id=_agent AND submitted_at IS NULL ORDER BY updated_at DESC,id LIMIT 50) x),'[]'::jsonb)) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.save_agent_lead_draft(_agent uuid, _id uuid, _revision integer, _fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.agent_lead_drafts%ROWTYPE;
BEGIN
  PERFORM public.collection_require_agent(_agent,true);
  IF _id IS NULL OR jsonb_typeof(_fields)<>'object' OR octet_length(_fields::text)>16000 THEN RAISE EXCEPTION 'Invalid draft'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('collection-drafts:'||_agent::text,0));
  SELECT * INTO r FROM public.agent_lead_drafts WHERE id=_id FOR UPDATE;
  IF FOUND THEN
    IF r.agent_id=_agent AND r.submitted_at IS NULL AND r.revision=_revision+1 AND r.fields=_fields THEN
      RETURN jsonb_build_object('id',r.id,'revision',r.revision,'updatedAt',r.updated_at,'fields',r.fields);
    END IF;
    IF r.agent_id<>_agent OR r.submitted_at IS NOT NULL OR r.revision<>_revision THEN RAISE EXCEPTION 'Draft changed; reload before saving'; END IF;
    UPDATE public.agent_lead_drafts SET fields=_fields,revision=revision+1,updated_at=now() WHERE id=_id RETURNING * INTO r;
  ELSE
    IF _revision<>0 OR (SELECT count(*) FROM public.agent_lead_drafts WHERE agent_id=_agent AND submitted_at IS NULL)>=50 THEN RAISE EXCEPTION 'Draft limit or stale revision'; END IF;
    INSERT INTO public.agent_lead_drafts(id,agent_id,fields) VALUES(_id,_agent,_fields) RETURNING * INTO r;
  END IF;
  RETURN jsonb_build_object('id',r.id,'revision',r.revision,'updatedAt',r.updated_at,'fields',r.fields);
END $$;

CREATE FUNCTION public.submit_collected_leads_atomic(_agent uuid, _request uuid, _rows jsonb, _draft uuid DEFAULT NULL, _revision integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    INSERT INTO public.audit_logs(action,entity_type,entity_id,actor_profile_id,metadata) VALUES('lead_created','lead',lead::text,_agent,jsonb_build_object('source','agent_app','receiptId',receipt,'routing','leadhub_nexus'));
    results:=results||jsonb_build_array(jsonb_build_object('index',idx-1,'status','accepted','receiptId',receipt));
  END LOOP;
  IF _draft IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(results) x WHERE x->>'status'='accepted') THEN
    UPDATE public.agent_lead_drafts SET submitted_at=now(),updated_at=now(),revision=revision+1 WHERE id=_draft;
  END IF;
  result:=jsonb_build_object('results',results,'today',d,'limit',10,'used',(SELECT count(*) FROM public.agent_lead_receipts WHERE agent_id=_agent AND work_day=d));
  INSERT INTO public.agent_lead_submission_requests(agent_id,request_key,payload_hash,result) VALUES(_agent,_request,hash,result);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.collection_require_agent(uuid,boolean),public.read_agent_lead_collection(uuid,text,text,date,date,integer),public.save_agent_lead_draft(uuid,uuid,integer,jsonb),public.submit_collected_leads_atomic(uuid,uuid,jsonb,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collection_require_agent(uuid,boolean),public.read_agent_lead_collection(uuid,text,text,date,date,integer),public.save_agent_lead_draft(uuid,uuid,integer,jsonb),public.submit_collected_leads_atomic(uuid,uuid,jsonb,uuid,integer) TO service_role;