
-- Optional link from a tax document (e.g. the Revenu Québec "Accusé de réception" PDF) to the
-- specific quarter it belongs to, so it can be attached from the quarterly declaration flow
-- while still showing up in the general Documents fiscaux library.
ALTER TABLE public.tax_documents ADD COLUMN quarter integer CHECK (quarter BETWEEN 1 AND 4);
