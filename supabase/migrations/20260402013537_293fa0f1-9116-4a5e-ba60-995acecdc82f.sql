
-- FIX 1: Block non-admin users from INSERT/UPDATE/DELETE on user_roles
-- Drop the overly broad admin ALL policy and replace with specific ones
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- FIX 2: Add missing UPDATE policy on tax-documents storage bucket
CREATE POLICY "Users can update their own tax documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- FIX 3: Restrict partnership_reimbursements SELECT for partners
-- Partners should only see reimbursements, not all users' data — but in this 2-person partnership context,
-- the current policy is intentional. We'll keep it but tighten by requiring authenticated role.
DROP POLICY IF EXISTS "Users can view reimbursements" ON public.partnership_reimbursements;

CREATE POLICY "Users can view own reimbursements"
ON public.partnership_reimbursements FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Partners can view all partnership reimbursements"
ON public.partnership_reimbursements FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'partner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
