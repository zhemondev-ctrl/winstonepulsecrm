CREATE OR REPLACE FUNCTION public.guard_assignment_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE target uuid:=coalesce(NEW.assigned_to,NEW.assigned_agent_id); d date:=(now() AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
 IF target IS NOT NULL AND (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id) THEN
  IF extract(isodow FROM d)=5 THEN RAISE EXCEPTION 'Friday distribution is disabled'; END IF;
  -- Owner rule 2026-11-14: HQ review/backlog holds stop COMPANY leads only; a
  -- self-collected lead may still reach its collector or an HQ-chosen agent.
  IF EXISTS(SELECT 1 FROM public.self_lead_attribution WHERE lead_id=NEW.id) THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.agent_accountability_reviews WHERE agent_id=target AND status<>'approved' AND unlock_for_date<=d) THEN RAISE EXCEPTION 'HQ review required before allocation'; END IF;
 END IF;
 RETURN NEW;
END $function$;

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
    BEGIN
      UPDATE public.leads SET assigned_to = r.collector_id, assigned_agent_id = r.collector_id,
        assignment_source = 'self_collected', work_date = d
        WHERE id = r.lead_id AND assigned_to IS NULL AND assigned_agent_id IS NULL;
      IF FOUND THEN
        INSERT INTO public.lead_assignments(lead_id, from_agent_id, to_agent_id, source, note)
        VALUES (r.lead_id, NULL, r.collector_id, 'self_collected', 'Own lead routed to collector — ' || left(coalesce(_actor_label,'LeadHub'),80));
        n := n + 1;
      END IF;
    EXCEPTION WHEN raise_exception OR unique_violation THEN
      -- One blocked row (e.g. Friday, phone conflict) never stops the others; it stays unassigned.
      NULL;
    END;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.route_collected_leads(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_collected_leads(text) TO service_role;