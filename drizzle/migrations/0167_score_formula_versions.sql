CREATE TABLE public.score_formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from date NOT NULL UNIQUE,
  formula text NOT NULL CHECK (formula IN ('points100','policy_v2')),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.score_formula_versions TO service_role;
ALTER TABLE public.score_formula_versions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER score_formula_versions_immutable BEFORE UPDATE OR DELETE ON public.score_formula_versions
  FOR EACH ROW EXECUTE FUNCTION public.append_only_block();
COMMENT ON TABLE public.score_formula_versions IS 'Dated daily-score formula versions; a day uses the latest effective_from <= day, earlier days the saved 100-point formula. Append-only.';