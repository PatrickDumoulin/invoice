import { useState } from "react";
import { useUpdateInvoice, useDeleteInvoice } from "@/hooks/useInvoices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Invoice, InvoiceType } from "@/types";
import { EXPENSE_OWNERS } from "@/types";

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

function ReviewCard({ invoice }: { invoice: Invoice }) {
  const [type, setType] = useState<InvoiceType>(invoice.type ?? "expense");
  const [isPartnership, setIsPartnership] = useState(invoice.is_partnership);
  const [expenseOwner, setExpenseOwner] = useState(invoice.expense_owner ?? EXPENSE_OWNERS[0]);
  const update = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();

  const isLoading = update.isPending || deleteInvoice.isPending;

  async function handleValidate() {
    await update.mutateAsync({
      id: invoice.id,
      status: "processed",
      type,
      is_partnership: isPartnership,
      expense_owner: expenseOwner,
    });
    toast.success(`« ${invoice.company_name ?? invoice.file_name} » validée`);
  }

  async function handleReject() {
    if (!confirm(`Supprimer « ${invoice.company_name ?? invoice.file_name} » ?`)) return;
    await deleteInvoice.mutateAsync(invoice.id);
  }

  const displayName = invoice.company_name ?? invoice.file_name ?? "Facture sans nom";
  const amount =
    invoice.amount != null
      ? new Intl.NumberFormat("fr-CA", {
          style: "currency",
          currency: invoice.currency ?? "CAD",
        }).format(invoice.amount)
      : null;

  return (
    <div className="border rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {invoice.invoice_date
                ? new Date(invoice.invoice_date).toLocaleDateString("fr-CA")
                : "Date inconnue"}
              {invoice.description ? ` · ${invoice.description}` : ""}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {amount ? (
            <>
              <p className="font-semibold">{amount}</p>
              {(invoice.tps_amount != null || invoice.tvq_amount != null) && (
                <p className="text-xs text-muted-foreground">
                  TPS {invoice.tps_amount?.toFixed(2) ?? "—"} · TVQ {invoice.tvq_amount?.toFixed(2) ?? "—"}
                </p>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-xs">Montant non extrait</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
        <Select value={type} onValueChange={(v) => setType(v as InvoiceType)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Dépense</SelectItem>
            <SelectItem value="revenue">Revenu</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id={`partnership-${invoice.id}`}
            checked={isPartnership}
            onCheckedChange={setIsPartnership}
          />
          <Label htmlFor={`partnership-${invoice.id}`} className="text-xs cursor-pointer">
            Partenariat
          </Label>
        </div>

        {isPartnership && (
          <Select value={expenseOwner} onValueChange={setExpenseOwner}>
            <SelectTrigger className="h-8 w-36 text-xs">
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
            className="gap-1.5 text-destructive hover:text-destructive hover:border-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Rejeter
          </Button>
          <Button
            size="sm"
            onClick={handleValidate}
            disabled={isLoading}
            className="gap-1.5"
          >
            {update.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Valider
          </Button>
        </div>
      </div>
    </div>
  );
}
