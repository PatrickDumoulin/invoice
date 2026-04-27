import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeHT, formatCurrency, formatDateShort, isAfterDate } from "@/lib/utils";
import { TPS_RATE, TVQ_RATE, TAX_REGISTRATION_DATE, type Invoice } from "@/types";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function InvoiceReconciliation({ invoices }: { invoices: Invoice[] }) {
  const rec = useMemo(() => {
    const allProcessed = invoices.filter((i) => i.status === "processed");
    const revenues = allProcessed.filter((i) => i.type === "revenue");
    const expenses = allProcessed.filter((i) => i.type === "expense");

    // Tax reconciliation only applies to post-registration invoices
    const taxRevenues = revenues.filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE));
    const taxExpenses = expenses.filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE));

    const method1 = {
      revenue: taxRevenues.reduce((s, i) => s + (i.amount_cad ?? 0), 0),
      expenses: taxExpenses.reduce((s, i) => s + (i.amount_cad ?? 0), 0),
      tpsCollected: taxRevenues.reduce((s, i) => s + (i.tps_amount ?? 0), 0),
      tvqCollected: taxRevenues.reduce((s, i) => s + (i.tvq_amount ?? 0), 0),
      tpsPaid: taxExpenses.reduce((s, i) => s + (i.tps_amount ?? 0), 0),
      tvqPaid: taxExpenses.reduce((s, i) => s + (i.tvq_amount ?? 0), 0),
    };

    const htRevenue = taxRevenues.reduce((s, i) => s + computeHT(i.amount_cad, i.tps_amount, i.tvq_amount), 0);
    const htExpenses = taxExpenses.reduce((s, i) => s + computeHT(i.amount_cad, i.tps_amount, i.tvq_amount), 0);

    const method2 = {
      tpsCollected: htRevenue * TPS_RATE,
      tvqCollected: htRevenue * TVQ_RATE,
      tpsPaid: htExpenses * TPS_RATE,
      tvqPaid: htExpenses * TVQ_RATE,
    };

    const tpsCollectedDiff = Math.abs(method1.tpsCollected - method2.tpsCollected);
    const tvqCollectedDiff = Math.abs(method1.tvqCollected - method2.tvqCollected);
    const tpsPaidDiff = Math.abs(method1.tpsPaid - method2.tpsPaid);
    const tvqPaidDiff = Math.abs(method1.tvqPaid - method2.tvqPaid);

    const THRESHOLD = 1.0;
    const reconciled =
      tpsCollectedDiff < THRESHOLD &&
      tvqCollectedDiff < THRESHOLD &&
      tpsPaidDiff < THRESHOLD &&
      tvqPaidDiff < THRESHOLD;

    // Per-invoice check: HT + TPS + TVQ must equal amount_cad for ALL processed invoices
    const perInvoiceIssues = [...revenues, ...expenses].filter((i) => {
      const total = (i.amount_cad ?? 0);
      const sumParts = ((i.amount_cad ?? 0) - (i.tps_amount ?? 0) - (i.tvq_amount ?? 0)) +
        (i.tps_amount ?? 0) + (i.tvq_amount ?? 0);
      return Math.abs(total - sumParts) > 0.02;
    });

    return {
      method1, method2, reconciled,
      tpsCollectedDiff, tvqCollectedDiff, tpsPaidDiff, tvqPaidDiff,
      perInvoiceIssues,
      htRevenue, htExpenses,
      taxRevenueCount: taxRevenues.length,
      taxExpenseCount: taxExpenses.length,
    };
  }, [invoices]);

  const rows = [
    {
      label: "TPS collectée (revenus)",
      m1: rec.method1.tpsCollected,
      m2: rec.method2.tpsCollected,
      diff: rec.tpsCollectedDiff,
    },
    {
      label: "TVQ collectée (revenus)",
      m1: rec.method1.tvqCollected,
      m2: rec.method2.tvqCollected,
      diff: rec.tvqCollectedDiff,
    },
    {
      label: "TPS payée (dépenses)",
      m1: rec.method1.tpsPaid,
      m2: rec.method2.tpsPaid,
      diff: rec.tpsPaidDiff,
    },
    {
      label: "TVQ payée (dépenses)",
      m1: rec.method1.tvqPaid,
      m2: rec.method2.tvqPaid,
      diff: rec.tvqPaidDiff,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Réconciliation double
          <Badge variant={rec.reconciled ? "success" : "destructive"}>
            {rec.reconciled ? (
              <><CheckCircle2 className="w-3 h-3 mr-1" />Réconciliée</>
            ) : (
              <><AlertTriangle className="w-3 h-3 mr-1" />Écart détecté</>
            )}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Méthode 1 : somme des taxes déclarées par facture. Méthode 2 : recalcul depuis le HT (montant − taxes).
          Seulement les factures après inscription ({rec.taxRevenueCount} revenus, {rec.taxExpenseCount} dépenses).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Élément</th>
                <th className="text-right py-2 font-medium">Méthode 1</th>
                <th className="text-right py-2 font-medium">Méthode 2</th>
                <th className="text-right py-2 font-medium">Écart</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-2">{row.label}</td>
                  <td className="text-right py-2">{formatCurrency(row.m1)}</td>
                  <td className="text-right py-2">{formatCurrency(row.m2)}</td>
                  <td className={`text-right py-2 font-medium ${row.diff < 1 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(row.diff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rec.perInvoiceIssues.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-800 mb-2">
              {rec.perInvoiceIssues.length} facture(s) avec HT+TPS+TVQ ≠ TTC :
            </p>
            <ul className="text-xs text-yellow-700 space-y-1">
              {rec.perInvoiceIssues.slice(0, 5).map((i) => (
                <li key={i.id}>• {i.company_name ?? i.file_name} ({formatDateShort(i.invoice_date)})</li>
              ))}
              {rec.perInvoiceIssues.length > 5 && (
                <li>… et {rec.perInvoiceIssues.length - 5} autre(s)</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
