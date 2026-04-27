ALTER TABLE public.invoices ADD COLUMN expense_owner text DEFAULT 'Patrick';

-- Set existing partnership expenses to Patrick
UPDATE public.invoices SET expense_owner = 'Patrick' WHERE is_partnership = true AND type = 'expense';