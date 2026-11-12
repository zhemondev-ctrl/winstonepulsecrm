CREATE TABLE public.agent_demerit_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.agent_accountability_reviews(id),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 1000),
  cancelled_by text NOT NULL DEFAULT 'Executive HQ',
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.agent_demerit_cancellations IS 'Each accountability review (system block) is one permanent demerit point; HQ may cancel a point once, with a reason. Append-only.';

GRANT ALL ON public.agent_demerit_cancellations TO service_role;
ALTER TABLE public.agent_demerit_cancellations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER agent_demerit_cancellations_append_only BEFORE UPDATE OR DELETE ON public.agent_demerit_cancellations
  FOR EACH ROW EXECUTE FUNCTION public.append_only_block();