
CREATE TABLE public.partnership_reimbursements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  reimbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partnership_reimbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reimbursements"
ON public.partnership_reimbursements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reimbursements"
ON public.partnership_reimbursements FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reimbursements"
ON public.partnership_reimbursements FOR DELETE
USING (auth.uid() = user_id);
