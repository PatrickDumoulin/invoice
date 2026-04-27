ALTER TABLE public.partnership_reimbursements ADD COLUMN recipient text DEFAULT 'Patrick';

UPDATE public.partnership_reimbursements SET recipient = 'Patrick' WHERE recipient IS NULL;