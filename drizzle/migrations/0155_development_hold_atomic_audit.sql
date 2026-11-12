-- Development notice ("maintenance mode") on/off: the state change and its
-- append-only audit row are written in one transaction, so the CRM can never be
-- closed or reopened without a record of who did it.
CREATE OR REPLACE FUNCTION public.set_development_hold_atomic(
  _expect_active boolean,
  _hold jsonb,
  _actor text,
  _actor_role text,
  _action text,
  _previous text,
  _next text,
  _reason text,
  _metadata jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur jsonb;
  audit_id uuid;
BEGIN
  IF _action NOT IN ('development_hold_started', 'development_hold_confirmed') THEN
    RAISE EXCEPTION 'Unsupported development notice action';
  END IF;
  IF coalesce(btrim(_actor), '') = '' OR _actor_role NOT IN ('it_console', 'architect') THEN
    RAISE EXCEPTION 'A named IT Console or System Architect actor is required';
  END IF;
  IF jsonb_typeof(_hold) IS DISTINCT FROM 'object' OR (_hold->>'active') IS NULL THEN
    RAISE EXCEPTION 'Invalid development notice state';
  END IF;

  -- Serialise concurrent on/off requests (also covers the very first insert).
  PERFORM pg_advisory_xact_lock(hashtext('development_hold'));
  SELECT value INTO cur FROM public.system_settings WHERE key = 'development_hold';

  IF coalesce((cur->>'active')::boolean, false) IS DISTINCT FROM _expect_active THEN
    RETURN jsonb_build_object('changed', false, 'hold', coalesce(cur, '{}'::jsonb), 'audit_id', NULL);
  END IF;

  INSERT INTO public.system_settings (key, value, updated_at)
  VALUES ('development_hold', _hold, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.maintenance_audit (actor, actor_role, action, previous_state, new_state, reason, metadata)
  VALUES (_actor, _actor_role, _action, _previous, _next, _reason, coalesce(_metadata, '{}'::jsonb))
  RETURNING id INTO audit_id;

  RETURN jsonb_build_object('changed', true, 'hold', _hold, 'audit_id', audit_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_development_hold_atomic(boolean, jsonb, text, text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_development_hold_atomic(boolean, jsonb, text, text, text, text, text, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_development_hold_atomic(boolean, jsonb, text, text, text, text, text, text, jsonb) TO service_role;

CREATE INDEX IF NOT EXISTS maintenance_audit_action_at_idx ON public.maintenance_audit (action, at DESC);