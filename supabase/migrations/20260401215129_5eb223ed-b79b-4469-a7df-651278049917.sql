ALTER TABLE public.invoices ADD COLUMN file_hash text;
CREATE INDEX idx_invoices_file_hash ON public.invoices (user_id, file_hash);