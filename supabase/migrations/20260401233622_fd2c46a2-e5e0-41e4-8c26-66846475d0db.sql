
ALTER TABLE public.invoices 
ADD COLUMN is_partnership boolean NOT NULL DEFAULT false,
ADD COLUMN partnership_reimbursed numeric DEFAULT 0;
