export type InvoiceType = "expense" | "revenue";
export type InvoiceStatus = "pending" | "processed" | "error";
export type AppRole = "admin" | "partner";
export type Currency = "CAD" | "USD" | "EUR" | "GBP" | "AUD" | "JPY" | "CHF" | "MXN";

export type ExpenseCategory =
  | "production"
  | "logiciels"
  | "marketing"
  | "hebergement"
  | "automatisation"
  | "formation"
  | "equipement"
  | "telecom"
  | "deplacements"
  | "repas"
  | "services_pro"
  | "assurances"
  | "frais_financiers"
  | "frais_admin"
  | "bureau"
  | "salaires"
  | "taxes_non_recup";

export interface Invoice {
  id: string;
  user_id: string;
  type: InvoiceType;
  company_name: string | null;
  invoice_date: string | null;
  amount: number | null;
  currency: Currency;
  description: string | null;
  file_name: string | null;
  file_path: string | null;
  status: InvoiceStatus;
  raw_extraction: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  amount_cad: number | null;
  exchange_rate: number | null;
  file_hash: string | null;
  tps_amount: number | null;
  tvq_amount: number | null;
  expense_category: ExpenseCategory | null;
  is_partnership: boolean;
  partnership_reimbursed: number;
  expense_owner: string | null;
}

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  purchase_cost: number;
  purchase_date: string;
  depreciation_rate: number;
  work_proportion: number;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  document_type: string | null;
  tax_year: number;
  notes: string | null;
  created_at: string;
}

export interface PartnershipReimbursement {
  id: string;
  user_id: string;
  amount: number;
  reimbursement_date: string;
  notes: string | null;
  recipient: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  production: "Production / Sous-traitants",
  logiciels: "Logiciels / SaaS",
  marketing: "Marketing / Leadgen",
  hebergement: "Hébergement / Serveurs",
  automatisation: "Automatisation",
  formation: "Formation / R&D",
  equipement: "Équipement",
  telecom: "Télécommunications",
  deplacements: "Déplacements",
  repas: "Repas (50% déd.)",
  services_pro: "Services professionnels",
  assurances: "Assurances",
  frais_financiers: "Frais financiers",
  frais_admin: "Frais admin",
  bureau: "Bureau",
  salaires: "Salaires",
  taxes_non_recup: "Taxes non récupérables",
};

export const TAX_REGISTRATION_DATE = "2025-12-01";
export const PARTNERSHIP_START_DATE = "2025-10-01";
export const TPS_RATE = 0.05;
export const TVQ_RATE = 0.09975;

export const EXPENSE_OWNERS = ["Patrick", "Partenaire"] as const;
export type ExpenseOwner = (typeof EXPENSE_OWNERS)[number];

export const TAX_TOLERANCE = 0.03;
export const FX_MIN = 1.2;
export const FX_MAX = 1.55;
