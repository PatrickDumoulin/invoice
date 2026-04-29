import { useState } from "react";
import { useUpdateInvoice, useDeleteInvoice } from "@/hooks/useInvoices";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Trash2, FileText, Loader2, ExternalLink, Calendar, Tag } from "lucide-react";
import { toast } from "sonner";
import type { Invoice, InvoiceType } from "@/types";
import { EXPENSE_OWNERS, EXPENSE_CATEGORY_LABELS } from "@/types";

export function InvoiceReviewQueue({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Aucune facture à valider</p>
        <p className="text-sm mt-1">Les factures importées par email apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {invoices.length} facture{invoices.length > 1 ? "s" : ""} importée{invoices.length > 1 ? "s" : ""} en attente de classification
      </p>
      {invoices.map((invoice) => (
        <ReviewCard key={invoice.id} invoice={invoice} />
      ))}
    </div>
  );
}

const fmt = (amount: number, currency = "CAD") =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(amount);

function ReviewCard({ invoice }: { invoice: Invoice }) {
  const [type, setType] = useState<InvoiceType>(invoice.type ?? "expense");
  const [isPartnership, setIsPartnership] = useState(invoice.is_partnership);
  const [expenseOwner, setExpenseOwner] = useState(invoice.expense_owner ?? EXPENSE_OWNERS[0]);
  const [openingFile, setOpeningFile] = useState(false);
  const update = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();

  const isLoading = update.isPending || deleteInvoice.isPending;

  async function handleView() {
    if (!invoice.file_path) return;
    setOpeningFile(true);
    try {
      const { data, error } = await supabase.storage
        .from("invoices")
        .createSignedUrl(invoice.file_path, 3600);
      if (error || !data?.signedUrl) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Impossible d'ouvrir le fichier");
    } finally {
      setOpeningFile(false);
    }
  }

  async function handleValidate() {
    await update.mutateAsync({
      id: invoice.id,
      status: "processed",
      type,
      is_partnership: isPartnership,
      expense_owner: expenseOwner,
      // Default to today if no date was extracted
      invoice_date: invoice.invoice_date ?? new Date().toISOString().split("T")[0],
    });
    toast.success(`« ${invoice.company_name ?? invoice.file_name} » validée`);
  }

  async function handleReject() {
    if (!confirm(`Supprimer « ${invoice.company_name ?? invoice.file_name} » ?`)) return;
    await deleteInvoice.mutateAsync(invoice.id);
  }

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Main info row */}
      <div className="p-4 flex items-start justify-between gap-4">
        {/* Left: identity */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <FileText className="w-5 h-5 shrink-0 text-muted-foreground mt-0.5" />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-base leading-tight truncate">
              {invoice.company_name ?? invoice.file_name ?? "Compagnie inconnue"}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {invoice.invoice_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(invoice.invoice_date).toLocaleDateString("fr-CA", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </span>
              )}
              {invoice.expense_category && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {EXPENSE_CATEGORY_LABELS[invoice.expense_category]}
                </span>
              )}
            </div>

            {invoice.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{invoice.description}</p>
            )}

            <p className="text-xs text-muted-foreground/60 truncate">{invoice.file_name}</p>
          </div>
        </div>

        {/* Right: amounts */}
        <div className="shrink-0 text-right space-y-0.5">
          {invoice.amount != null ? (
            <>
              <p className="text-lg font-bold tabular-nums">
                {fmt(invoice.amount, invoice.currency ?? "CAD")}
              </p>
              {invoice.currency && invoice.currency !== "CAD" && invoice.amount_cad != null && (
                <p className="text-xs text-muted-foreground">≈ {fmt(invoice.amount_cad)} CAD</p>
              )}
              <div className="text-xs text-muted-foreground space-y-0.5 pt-0.5">
                {invoice.tps_amount != null && invoice.tps_amount > 0 && (
                  <p>TPS {fmt(invoice.tps_amount)}</p>
                )}
                {invoice.tvq_amount != null && invoice.tvq_amount > 0 && (
                  <p>TVQ {fmt(invoice.tvq_amount)}</p>
                )}
              </div>
            </>
          ) : (
            <Badge variant="outline" className="text-xs">Montant non extrait</Badge>
          )}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t bg-muted/30">
        <Button
          variant="outline"
          size="sm"
          onClick={handleView}
          disabled={openingFile || !invoice.file_path}
          className="gap-1.5 h-8"
        >
          {openingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
          Voir
        </Button>

        <Select value={type} onValueChange={(v) => setType(v as InvoiceType)}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Dépense</SelectItem>
            <SelectItem value="revenue">Revenu</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Switch
            id={`partnership-${invoice.id}`}
            checked={isPartnership}
            onCheckedChange={setIsPartnership}
            className="scale-90"
          />
          <Label htmlFor={`partnership-${invoice.id}`} className="text-xs cursor-pointer">
            Partenariat
          </Label>
        </div>

        {isPartnership && (
          <Select value={expenseOwner} onValueChange={setExpenseOwner}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_OWNERS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            disabled={isLoading}
            className="gap-1.5 h-8 text-destructive hover:text-destructive hover:border-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Rejeter
          </Button>
          <Button
            size="sm"
            onClick={handleValidate}
            disabled={isLoading}
            className="gap-1.5 h-8"
          >
            {update.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckCircle2 className="w-3.5 h-3.5" />
            }
            Valider
          </Button>
        </div>
      </div>
    </div>
  );
}
