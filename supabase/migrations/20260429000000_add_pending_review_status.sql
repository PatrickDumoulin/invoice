
-- Allow 'pending_review' as a valid invoice status (for email-imported invoices awaiting user classification)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('pending', 'processed', 'error', 'pending_review'));
