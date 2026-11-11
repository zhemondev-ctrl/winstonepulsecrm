CREATE TABLE public.meeting_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  meeting_date date NOT NULL,
  attendees text,
  summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting','decided','withdrawn')),
  created_by text NOT NULL DEFAULT 'IT Console',
  first_opened_at timestamptz,
  final_signer text,
  final_note text,
  finalized_at timestamptz,
  withdrawn_reason text,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_approval_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.meeting_approval_requests(id),
  position integer NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 300),
  detail text,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','approved_with_changes','rejected')),
  decision_comment text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, position)
);

CREATE TABLE public.meeting_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.meeting_approval_requests(id),
  item_id uuid REFERENCES public.meeting_approval_items(id),
  action text NOT NULL,
  actor text NOT NULL,
  note text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meeting_approval_items_request_idx ON public.meeting_approval_items (request_id, position);
CREATE INDEX meeting_approval_events_request_idx ON public.meeting_approval_events (request_id, created_at);
CREATE INDEX meeting_approval_requests_created_idx ON public.meeting_approval_requests (created_at DESC);

GRANT ALL ON public.meeting_approval_requests TO service_role;
GRANT ALL ON public.meeting_approval_items TO service_role;
GRANT ALL ON public.meeting_approval_events TO service_role;

ALTER TABLE public.meeting_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_approval_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_approval_events ENABLE ROW LEVEL SECURITY;

-- History is permanent: no deletes anywhere, events never change.
CREATE TRIGGER meeting_approval_requests_no_delete BEFORE DELETE ON public.meeting_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.append_only_block();
CREATE TRIGGER meeting_approval_items_no_delete BEFORE DELETE ON public.meeting_approval_items
  FOR EACH ROW EXECUTE FUNCTION public.append_only_block();
CREATE TRIGGER meeting_approval_events_append_only BEFORE UPDATE OR DELETE ON public.meeting_approval_events
  FOR EACH ROW EXECUTE FUNCTION public.append_only_block();

CREATE OR REPLACE FUNCTION public.guard_meeting_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_status text;
BEGIN
  IF TG_TABLE_NAME = 'meeting_approval_items' THEN
    SELECT status INTO parent_status FROM public.meeting_approval_requests WHERE id = NEW.request_id;
    IF parent_status IS DISTINCT FROM 'awaiting' THEN
      RAISE EXCEPTION 'This approval is closed; decisions can no longer change';
    END IF;
    IF NEW.request_id <> OLD.request_id OR NEW.title <> OLD.title OR NEW.detail IS DISTINCT FROM OLD.detail OR NEW.position <> OLD.position THEN
      RAISE EXCEPTION 'Approval items cannot be rewritten';
    END IF;
  ELSE
    IF OLD.status <> 'awaiting' AND (NEW.status <> OLD.status OR NEW.final_signer IS DISTINCT FROM OLD.final_signer OR NEW.final_note IS DISTINCT FROM OLD.final_note) THEN
      RAISE EXCEPTION 'This approval is closed';
    END IF;
    IF NEW.title <> OLD.title OR NEW.summary <> OLD.summary OR NEW.meeting_date <> OLD.meeting_date OR NEW.attendees IS DISTINCT FROM OLD.attendees THEN
      RAISE EXCEPTION 'Meeting summary cannot be rewritten after it is sent';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER meeting_approval_items_guard BEFORE UPDATE ON public.meeting_approval_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_meeting_approval();
CREATE TRIGGER meeting_approval_requests_guard BEFORE UPDATE ON public.meeting_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_meeting_approval();