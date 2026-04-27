ALTER TABLE public.invoices ADD COLUMN amount_cad numeric;
ALTER TABLE public.invoices ADD COLUMN exchange_rate numeric;

-- Backfill: for existing CAD invoices, amount_cad = amount; for USD, use approximate rate
UPDATE public.invoices SET amount_cad = amount, exchange_rate = 1.0 WHERE currency = 'CAD' OR currency IS NULL;
UPDATE public.invoices SET amount_cad = amount * 1.44, exchange_rate = 1.44 WHERE currency = 'USD' AND amount_cad IS NULL;