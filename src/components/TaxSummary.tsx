import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency, isAfterDate } from "@/lib/utils";
import { TAX_REGISTRATION_DATE, TPS_RATE, TVQ_RATE, type Invoice } from "@/types";
import { Info } from "lucide-react";

export function TaxSummary({ invoices, year, totalCCA = 0 }: { invoices: Invoice[]; year: number; totalCCA?: number }) {
  const stats = useMemo(() => {
    const yearInvoices = invoices.filter((i) => {
      if (!i.invoice_date) return false;
      return new Date(i.invoice_date).getFullYear() === year;
    });

    const revenues = yearInvoices.filter((i) => i.type === "revenue");
    const expenses = yearInvoices.filter((i) => i.type === "expense");

    const tpsCollected = revenues
      .filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE))
      .reduce((s, i) => s + (i.tps_amount ?? 0), 0);

    const tvqCollected = revenues
      .filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE))
      .reduce((s, i) => s + (i.tvq_amount ?? 0), 0);

    const tpsCTI = expenses
      .filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE))
      .reduce((s, i) => s + (i.tps_amount ?? 0), 0);

    const tvqRTI = expenses
      .filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE))
      .reduce((s, i) => s + (i.tvq_amount ?? 0), 0);

    const tpsNet = tpsCollected - tpsCTI;
    const tvqNet = tvqCollected - tvqRTI;

    // HT = amount_cad - tps - tvq (même logique que rapport d'impôt original)
    const totalRevenue = revenues.reduce(
      (s, i) => s + (i.amount_cad ?? 0) - (i.tps_amount ?? 0) - (i.tvq_amount ?? 0),
      0
    );
    const totalExpenses = expenses.reduce(
      (s, i) => s + (i.amount_cad ?? 0) - (i.tps_amount ?? 0) - (i.tvq_amount ?? 0),
      0
    );

    const htRevenue = revenues
      .filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE))
      .reduce((s, i) => {
        const ht = (i.amount_cad ?? 0) - (i.tps_amount ?? 0) - (i.tvq_amount ?? 0);
        return s + ht;
      }, 0);

    const expectedTPS = htRevenue * TPS_RATE;
    const expectedTVQ = htRevenue * TVQ_RATE;

    return {
      tpsCollected, tvqCollected, tpsCTI, tvqRTI, tpsNet, tvqNet,
      totalRevenue, totalExpenses, htRevenue,
      expectedTPS, expectedTVQ,
      taxableRevenues: revenues.filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE)).length,
      preRegExpenses: expenses.filter((i) => !isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE)).length,
      beneficeNet: totalRevenue - totalExpenses - totalCCA,
    };
  }, [invoices, year]);

  const rows = [
    {
      label: "TPS collectée (revenus)",
      value: stats.tpsCollected,
      description: "Factures de revenus après inscription",
      color: "text-green-700",
    },
    {
      label: "CTI (TPS sur dépenses)",
      value: -stats.tpsCTI,
      description: "Dépenses après inscription",
      color: "text-red-700",
    },
    {
      label: "TPS nette à remettre",
      value: stats.tpsNet,
      description: "TPS collectée − CTI",
      color: stats.tpsNet >= 0 ? "text-blue-700 font-bold" : "text-green-700 font-bold",
      separator: true,
    },
    {
      label: "TVQ collectée (revenus)",
      value: stats.tvqCollected,
      description: "Factures de revenus après inscription",
      color: "text-green-700",
    },
    {
      label: "RTI (TVQ sur dépenses)",
      value: -stats.tvqRTI,
      description: "Dépenses après inscription",
      color: "text-red-700",
    },
    {
      label: "TVQ nette à remettre",
      value: stats.tvqNet,
      description: "TVQ collectée − RTI",
      color: stats.tvqNet >= 0 ? "text-blue-700 font-bold" : "text-green-700 font-bold",
      separator: true,
    },
  ];

  return (
    <div className="space-y-4">
      {year === 2025 && (
        <Alert variant="warning">
          <Info className="w-4 h-4" />
          <AlertDescription>
            Inscription aux taxes le <strong>1er décembre 2025</strong>. Seules les transactions à partir de cette
            date sont incluses dans les CTI/RTI. Les {stats.preRegExpenses} dépenses antérieures sont exclues.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Sommaire TPS/TVQ — Année {year}
            <Badge variant="outline">{stats.taxableRevenues} revenus imposables</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row, i) => (
            <div key={i}>
              {row.separator && i > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                </div>
                <p className={`text-base ${row.color}`}>{formatCurrency(Math.abs(row.value))}</p>
              </div>
            </div>
          ))}

          <Separator />
          <div className="flex justify-between items-center pt-2">
            <div>
              <p className="font-semibold">Total taxes nettes à remettre</p>
              <p className="text-xs text-muted-foreground">TPS + TVQ</p>
            </div>
            <p className={`text-xl font-bold ${stats.tpsNet + stats.tvqNet >= 0 ? "text-blue-700" : "text-green-700"}`}>
              {formatCurrency(stats.tpsNet + stats.tvqNet)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Résumé fiscal {year}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Revenus nets (HT)</span>
            <span className="font-medium text-green-600">{formatCurrency(stats.totalRevenue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dépenses nettes (HT)</span>
            <span className="font-medium text-red-600">− {formatCurrency(stats.totalExpenses)}</span>
          </div>
          {totalCCA > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amortissements (DPA)</span>
              <span className="font-medium text-red-600">− {formatCurrency(totalCCA)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Bénéfice net</span>
            <span className={stats.beneficeNet >= 0 ? "text-blue-600" : "text-red-600"}>
              {formatCurrency(stats.beneficeNet)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between pt-1">
            <span className="text-muted-foreground">TPS nette à remettre</span>
            <span className="font-medium">{formatCurrency(stats.tpsNet)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TVQ nette à remettre</span>
            <span className="font-medium">{formatCurrency(stats.tvqNet)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total taxes à remettre</span>
            <span className="text-blue-600">{formatCurrency(stats.tpsNet + stats.tvqNet)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
