ALTER TABLE public.meeting_approval_items ADD COLUMN md_decision_date date;
COMMENT ON COLUMN public.meeting_approval_items.md_decision_date IS 'MD decision date reported by Executive HQ; decided_at remains the actual CRM recording timestamp. Existing decisions retain unknown dates.';
CREATE OR REPLACE FUNCTION public.validate_meeting_md_date() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE meeting_day date;
BEGIN
 SELECT meeting_date INTO meeting_day FROM public.meeting_approval_requests WHERE id=NEW.request_id;
 IF NEW.md_decision_date IS NOT NULL AND (NEW.md_decision_date < meeting_day OR NEW.md_decision_date > (now() AT TIME ZONE 'Asia/Dhaka')::date) THEN RAISE EXCEPTION 'MD decision date must be between meeting date and today in Dhaka'; END IF;
 IF NEW.decision='pending' AND NEW.md_decision_date IS NOT NULL THEN RAISE EXCEPTION 'Pending items cannot have an MD decision date'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER meeting_md_date_guard BEFORE INSERT OR UPDATE ON public.meeting_approval_items FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_md_date();