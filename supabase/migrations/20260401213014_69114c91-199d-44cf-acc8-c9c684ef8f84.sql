
-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'revenue')),
  company_name TEXT,
  invoice_date DATE,
  amount DECIMAL(12,2),
  currency TEXT DEFAULT 'CAD' CHECK (currency IN ('CAD', 'USD')),
  description TEXT,
  file_name TEXT,
  file_path TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'error')),
  raw_extraction JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoices" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);

CREATE POLICY "Users can upload their own invoices" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their own invoices" ON storage.objects FOR SELECT USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own invoices" ON storage.objects FOR DELETE USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
