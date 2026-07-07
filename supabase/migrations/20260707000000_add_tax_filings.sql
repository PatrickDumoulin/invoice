
-- Tracks which TPS/TVQ quarterly (or annual) declarations have already been filed with Revenu
-- Québec, so the app can show "Déclaré" instead of a due-date badge once it's done.
CREATE TABLE public.tax_filings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  filed_at timestamp with time zone NOT NULL DEFAULT now(),
  net_tps numeric,
  net_tvq numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, quarter)
);

ALTER TABLE public.tax_filings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tax filings" ON public.tax_filings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tax filings" ON public.tax_filings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tax filings" ON public.tax_filings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tax filings" ON public.tax_filings FOR DELETE USING (auth.uid() = user_id);
