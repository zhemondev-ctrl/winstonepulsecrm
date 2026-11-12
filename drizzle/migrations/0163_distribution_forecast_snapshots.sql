CREATE TABLE public.distribution_forecast_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taken_at timestamptz NOT NULL DEFAULT now(),
  target_day date NOT NULL,
  blocked text NOT NULL DEFAULT 'none',
  would_assign integer NOT NULL DEFAULT 0,
  per_agent jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT ALL ON public.distribution_forecast_snapshots TO service_role;
ALTER TABLE public.distribution_forecast_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX distribution_forecast_snapshots_day_idx ON public.distribution_forecast_snapshots (target_day, taken_at DESC);
CREATE OR REPLACE FUNCTION public.forecast_snapshots_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Forecast snapshots are append-only'; END $$;
CREATE TRIGGER forecast_snapshots_no_change BEFORE UPDATE OR DELETE ON public.distribution_forecast_snapshots
FOR EACH ROW EXECUTE FUNCTION public.forecast_snapshots_append_only();
COMMENT ON TABLE public.distribution_forecast_snapshots IS 'Server-only, append-only: per-agent dry-run forecast saved each time the LeadHub dry run is opened.';