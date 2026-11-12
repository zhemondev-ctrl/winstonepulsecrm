ALTER TABLE public.call_reports ADD COLUMN IF NOT EXISTS call_started_source text;
ALTER TABLE public.call_reports ADD CONSTRAINT call_reports_call_started_source_check
  CHECK (call_started_source IS NULL OR call_started_source IN ('device', 'call_record', 'report_opened')) NOT VALID;
COMMENT ON COLUMN public.call_reports.call_started_source IS
  'Where call_started_at came from: device (phone sent it), call_record (linked call row), report_opened (no call time known; time the report opened). Older rows stay NULL.';

CREATE OR REPLACE FUNCTION public.stamp_call_report_start()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.call_started_at IS NULL THEN
      NEW.call_started_at := now();
      NEW.call_started_source := 'report_opened';
    ELSIF NEW.call_started_source IS NULL THEN
      NEW.call_started_source := 'device';
    END IF;
    RETURN NEW;
  END IF;
  -- Once saved, the start time is evidence and never changes.
  IF OLD.call_started_at IS NOT NULL AND NEW.call_started_at IS DISTINCT FROM OLD.call_started_at THEN
    RAISE EXCEPTION 'call start time is saved evidence and cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF OLD.call_started_source IS NOT NULL AND NEW.call_started_source IS DISTINCT FROM OLD.call_started_source THEN
    RAISE EXCEPTION 'call start source cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_call_report_start ON public.call_reports;
CREATE TRIGGER stamp_call_report_start
  BEFORE INSERT OR UPDATE OF call_started_at, call_started_source ON public.call_reports
  FOR EACH ROW EXECUTE FUNCTION public.stamp_call_report_start();

CREATE INDEX IF NOT EXISTS call_reports_agent_started_idx ON public.call_reports (agent_id, call_started_at);