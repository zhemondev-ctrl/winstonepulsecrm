ALTER TABLE public.meeting_approval_items
  ADD COLUMN implementation_status text NOT NULL DEFAULT 'not_started' CHECK (implementation_status IN ('not_started','implemented')),
  ADD COLUMN implemented_at timestamptz,
  ADD COLUMN implemented_by text,
  ADD COLUMN implementation_note text;

COMMENT ON COLUMN public.meeting_approval_items.implementation_status IS 'IT may mark implemented only after Executive HQ finalized the request and the item was approved (with or without changes). Implemented is permanent.';

CREATE OR REPLACE FUNCTION public.guard_meeting_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE parent_status text;
BEGIN
  IF TG_TABLE_NAME = 'meeting_approval_items' THEN
    SELECT status INTO parent_status FROM public.meeting_approval_requests WHERE id = NEW.request_id;
    IF NEW.request_id <> OLD.request_id OR NEW.title <> OLD.title OR NEW.detail IS DISTINCT FROM OLD.detail OR NEW.position <> OLD.position THEN
      RAISE EXCEPTION 'Approval items cannot be rewritten';
    END IF;
    IF NEW.implementation_status IS DISTINCT FROM OLD.implementation_status
       OR NEW.implemented_at IS DISTINCT FROM OLD.implemented_at
       OR NEW.implemented_by IS DISTINCT FROM OLD.implemented_by
       OR NEW.implementation_note IS DISTINCT FROM OLD.implementation_note THEN
      -- The only allowed implementation change: not_started -> implemented, after the final MD/HQ approval.
      IF OLD.implementation_status <> 'not_started' OR NEW.implementation_status <> 'implemented' THEN
        RAISE EXCEPTION 'Implementation records are permanent';
      END IF;
      IF parent_status IS DISTINCT FROM 'decided' OR OLD.decision NOT IN ('approved','approved_with_changes') THEN
        RAISE EXCEPTION 'Only a finally approved decision can be marked implemented';
      END IF;
      IF NEW.implemented_at IS NULL OR NEW.implemented_by IS NULL OR coalesce(btrim(NEW.implementation_note), '') = '' THEN
        RAISE EXCEPTION 'Implementation needs who, when and a note';
      END IF;
      IF NEW.decision IS DISTINCT FROM OLD.decision OR NEW.decision_comment IS DISTINCT FROM OLD.decision_comment
         OR NEW.decided_by IS DISTINCT FROM OLD.decided_by OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
         OR NEW.md_decision_date IS DISTINCT FROM OLD.md_decision_date THEN
        RAISE EXCEPTION 'This approval is closed; decisions can no longer change';
      END IF;
      RETURN NEW;
    END IF;
    IF parent_status IS DISTINCT FROM 'awaiting' THEN
      RAISE EXCEPTION 'This approval is closed; decisions can no longer change';
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
$function$;

CREATE OR REPLACE FUNCTION public.block_meeting_item_insert_implemented()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.implementation_status <> 'not_started' OR NEW.implemented_at IS NOT NULL OR NEW.implemented_by IS NOT NULL OR NEW.implementation_note IS NOT NULL THEN
    RAISE EXCEPTION 'New meeting decisions start as not implemented';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER meeting_approval_items_insert_guard BEFORE INSERT ON public.meeting_approval_items
  FOR EACH ROW EXECUTE FUNCTION public.block_meeting_item_insert_implemented();