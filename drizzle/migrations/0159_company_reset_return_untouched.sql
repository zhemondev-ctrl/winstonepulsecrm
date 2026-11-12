-- A company reset return is not work: the returned lead stays re-assignable (to another agent).
CREATE OR REPLACE FUNCTION public.lead_is_recalled_untouched(_lead_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.lead_neglect_recalls WHERE lead_id=_lead_id)
 AND EXISTS(SELECT 1 FROM public.leads WHERE id=_lead_id AND coalesce(call_count,0)=0 AND coalesce(call_attempts,0)=0 AND last_call_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.call_reports WHERE lead_id=_lead_id)
 AND NOT EXISTS(SELECT 1 FROM public.call_recordings WHERE lead_id=_lead_id)
 AND NOT EXISTS(SELECT 1 FROM public.lead_events WHERE lead_id=_lead_id AND kind NOT IN ('workday_moved','neglect_warning','neglect_recalled','hq_review_comment','company_reset_returned'));
$function$;

/**
 * One-time company reset: every open company lead an agent still holds with
 * zero work (no call, attempt, report, recording, follow-up or other history,
 * and no worked duplicate phone) goes back to the LeadHub Nexus pool.
 * Self-collected, closed and worked leads are untouched. Nothing is deleted:
 * each return writes an append-only recall row, an assignment row and a lead
 * event. Refuses to run before _not_before. Re-running is harmless.
 */
CREATE OR REPLACE FUNCTION public.company_reset_return_untouched(_business_date date, _reason text, _not_before timestamptz)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  owner uuid;
  at timestamptz;
  recall_id uuid;
  freed int;
  returned int := 0;
  per_agent jsonb := '{}'::jsonb;
BEGIN
  IF now() < _not_before THEN
    RAISE EXCEPTION 'company reset is scheduled for % and cannot run earlier', _not_before USING ERRCODE = '55000';
  END IF;
  IF coalesce(trim(_reason), '') = '' THEN
    RAISE EXCEPTION 'reset reason required' USING ERRCODE = '22023';
  END IF;

  FOR r IN
    SELECT l.id, l.created_at, coalesce(l.assigned_to, l.assigned_agent_id) AS owner_id
    FROM public.leads l
    WHERE coalesce(l.assigned_to, l.assigned_agent_id) IS NOT NULL
      AND l.status <> 'closed'
      AND (l.assignment_source IS NULL OR l.assignment_source NOT IN ('self', 'duplicate_skipped'))
      AND coalesce(l.call_count, 0) = 0
      AND coalesce(l.call_attempts, 0) = 0
      AND l.last_call_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.call_reports x WHERE x.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.call_recordings x WHERE x.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.follow_up_events x WHERE x.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.lead_events e WHERE e.lead_id = l.id
                      AND e.kind NOT IN ('workday_moved','neglect_warning','neglect_recalled','hq_review_comment','company_reset_returned'))
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_phone_keys k
        JOIN public.lead_phone_keys k2 ON k2.canonical_phone = k.canonical_phone AND k2.lead_id <> l.id
        JOIN public.leads o ON o.id = k2.lead_id
        WHERE k.lead_id = l.id
          AND (coalesce(o.call_count, 0) > 0 OR coalesce(o.call_attempts, 0) > 0 OR o.last_call_at IS NOT NULL
               OR EXISTS (SELECT 1 FROM public.call_reports x WHERE x.lead_id = o.id)
               OR EXISTS (SELECT 1 FROM public.call_recordings x WHERE x.lead_id = o.id))
      )
    ORDER BY l.id
    FOR UPDATE OF l SKIP LOCKED
  LOOP
    owner := r.owner_id;
    SELECT max(a.created_at) INTO at FROM public.lead_assignments a WHERE a.lead_id = r.id AND a.to_agent_id = owner;
    INSERT INTO public.lead_neglect_recalls (lead_id, agent_id, assigned_at, business_date, reason, evidence)
    VALUES (r.id, owner, coalesce(at, r.created_at), _business_date, _reason,
            jsonb_build_object('kind', 'company_reset', 'calls', 0, 'reports', 0, 'recordings', 0, 'follow_ups', 0, 'assignment_trail', at IS NOT NULL))
    ON CONFLICT (lead_id, agent_id, assigned_at) DO NOTHING
    RETURNING id INTO recall_id;
    IF recall_id IS NULL THEN CONTINUE; END IF;

    UPDATE public.leads
       SET assigned_to = NULL, assigned_agent_id = NULL, assignment_source = 'company_reset', work_date = NULL
     WHERE id = r.id AND coalesce(assigned_to, assigned_agent_id) = owner;
    GET DIAGNOSTICS freed = ROW_COUNT;
    IF freed = 0 THEN
      RAISE EXCEPTION 'lead % changed owner during reset', r.id;
    END IF;

    INSERT INTO public.lead_assignments (lead_id, from_agent_id, to_agent_id, source, note)
    VALUES (r.id, owner, NULL, 'company_reset', _reason);
    INSERT INTO public.lead_events (lead_id, agent_id, kind, detail)
    VALUES (r.id, owner, 'company_reset_returned', 'কোম্পানি রিসেট — না-ছোঁয়া লিড LeadHub Nexus-এ ফেরত (অবহেলার অভিযোগ নয়)');

    returned := returned + 1;
    per_agent := jsonb_set(per_agent, ARRAY[owner::text], to_jsonb(coalesce((per_agent ->> owner::text)::int, 0) + 1));
  END LOOP;

  INSERT INTO public.audit_logs (actor_label, action, entity_type, metadata)
  VALUES ('Company reset (scheduled)', 'company_reset_returned', 'lead_pool',
          jsonb_build_object('business_date', _business_date, 'returned', returned, 'per_agent', per_agent, 'ran_at', now()));
  RETURN jsonb_build_object('returned', returned, 'per_agent', per_agent);
END;
$function$;

REVOKE ALL ON FUNCTION public.company_reset_return_untouched(date, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_reset_return_untouched(date, text, timestamptz) TO service_role;