import { createClient } from "@supabase/supabase-js";
import type { Invoice, Asset, TaxDocument, PartnershipReimbursement, UserRole } from "@/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Variables d'environnement Supabase manquantes. Vérifiez votre fichier .env");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Database = {
  public: {
    Tables: {
      invoices: { Row: Invoice; Insert: Omit<Invoice, "id" | "created_at" | "updated_at">; Update: Partial<Invoice> };
      assets: { Row: Asset; Insert: Omit<Asset, "id" | "created_at" | "updated_at">; Update: Partial<Asset> };
      tax_documents: { Row: TaxDocument; Insert: Omit<TaxDocument, "id" | "created_at">; Update: Partial<TaxDocument> };
      partnership_reimbursements: { Row: PartnershipReimbursement; Insert: Omit<PartnershipReimbursement, "id" | "created_at">; Update: Partial<PartnershipReimbursement> };
      user_roles: { Row: UserRole; Insert: Omit<UserRole, "id">; Update: Partial<UserRole> };
    };
  };
};
