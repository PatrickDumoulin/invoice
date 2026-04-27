
-- Add expense_category to invoices
ALTER TABLE public.invoices ADD COLUMN expense_category text;

-- Create assets table for depreciation
CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  purchase_cost numeric NOT NULL,
  purchase_date date NOT NULL,
  depreciation_rate numeric NOT NULL DEFAULT 30,
  work_proportion numeric NOT NULL DEFAULT 100,
  category text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets" ON public.assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own assets" ON public.assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own assets" ON public.assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own assets" ON public.assets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create tax_documents table for additional uploads
CREATE TABLE public.tax_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  document_type text,
  tax_year integer NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tax documents" ON public.tax_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tax documents" ON public.tax_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tax documents" ON public.tax_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tax documents" ON public.tax_documents FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket for tax documents
INSERT INTO storage.buckets (id, name, public) VALUES ('tax-documents', 'tax-documents', false);

CREATE POLICY "Users can upload tax documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their tax documents" ON storage.objects FOR SELECT USING (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their tax documents" ON storage.objects FOR DELETE USING (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
