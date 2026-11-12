ALTER TABLE public.site_visits ADD COLUMN created_by_profile_id uuid;
COMMENT ON COLUMN public.site_visits.created_by_profile_id IS 'Profile that entered the visit. Agents may change only visits they entered (MD report 11 Nov 2026, proposal 6). Older rows keep NULL and fall back to the saved entry name.';

CREATE OR REPLACE FUNCTION public.protect_site_visit_entered_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.created_by_profile_id IS DISTINCT FROM OLD.created_by_profile_id THEN
    RAISE EXCEPTION 'Who entered a site visit cannot be changed';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER site_visits_entered_by_guard BEFORE UPDATE ON public.site_visits
  FOR EACH ROW EXECUTE FUNCTION public.protect_site_visit_entered_by();