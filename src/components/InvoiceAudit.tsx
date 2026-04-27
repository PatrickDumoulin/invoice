import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { computeHT, formatCurrency, formatDateShort, isAfterDate } from "@/lib/utils";
import { TAX_TOLERANCE, FX_MIN, FX_MAX, TPS_RATE, TVQ_RATE, TAX_REGISTRATION_DATE, type Invoice } from "@/types";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface AuditIssue {
  invoiceId: string;
  company: string;
  date: string;
  type: string;
  description: string;
  severity: "error" | "warning";
}

export function InvoiceAudit({ invoices }: { invoices: Invoice[] }) {
  const issues = useMemo<AuditIssue[]>(() => {
    const result: AuditIssue[] = [];

    for (const inv of invoices) {
      if (inv.status !== "processed" || !inv.amount_cad) continue;

      const company = inv.company_name ?? inv.file_name ?? inv.id;
      const date = formatDateShort(inv.invoice_date);

      const ht = computeHT(inv.amount_cad, inv.tps_amount, inv.tvq_amount);

      if (ht < -0.05) {
        result.push({
          invoiceId: inv.id,
          company,
          date,
          type: "HT négatif",
          description: `HT calculé: ${formatCurrency(ht)} — les taxes dépassent le montant total`,
          severity: "error",
        });
      }

      const isTaxable = isAfterDate(inv.invoice_date, TAX_REGISTRATION_DATE);

      if (isTaxable && ht > 0.01 && inv.tps_amount !== null && inv.tps_amount > 0) {
        const expectedTPS = ht * TPS_RATE;
        const diff = Math.abs((inv.tps_amount ?? 0) - expectedTPS);
        if (diff > TAX_TOLERANCE) {
          result.push({
            invoiceId: inv.id,
            company,
            date,
            type: "TPS incorrecte",
            description: `TPS déclarée: ${formatCurrency(inv.tps_amount)} | Attendue: ${formatCurrency(expectedTPS)} (diff: ${formatCurrency(diff)})`,
            severity: diff > 1 ? "error" : "warning",
          });
        }
      }

      if (isTaxable && ht > 0.01 && inv.tvq_amount !== null && inv.tvq_amount > 0) {
        const expectedTVQ = ht * TVQ_RATE;
        const diff = Math.abs((inv.tvq_amount ?? 0) - expectedTVQ);
        if (diff > TAX_TOLERANCE) {
          result.push({
            invoiceId: inv.id,
            company,
            date,
            type: "TVQ incorrecte",
            description: `TVQ déclarée: ${formatCurrency(inv.tvq_amount)} | Attendue: ${formatCurrency(expectedTVQ)} (diff: ${formatCurrency(diff)})`,
            severity: diff > 1 ? "error" : "warning",
          });
        }
      }

      if (inv.currency && inv.currency !== "CAD" && inv.exchange_rate) {
        if (inv.exchange_rate < FX_MIN || inv.exchange_rate > FX_MAX) {
          result.push({
            invoiceId: inv.id,
            company,
            date,
            type: "Taux de change suspect",
            description: `${inv.currency}/CAD: ${inv.exchange_rate.toFixed(4)} (attendu entre ${FX_MIN} et ${FX_MAX})`,
            severity: "warning",
          });
        }
      }

      if (inv.amount_cad && inv.amount && inv.exchange_rate && inv.currency !== "CAD") {
        const expectedCAD = inv.amount * inv.exchange_rate;
        const diff = Math.abs(inv.amount_cad - expectedCAD);
        if (diff > 0.05) {
          result.push({
            invoiceId: inv.id,
            company,
            date,
            type: "Incohérence conversion devise",
            description: `amount_cad: ${formatCurrency(inv.amount_cad)} | amount × rate: ${formatCurrency(expectedCAD)} (diff: ${formatCurrency(diff)})`,
            severity: "warning",
          });
        }
      }
    }

    return result.sort((a, b) => (a.severity === "error" ? -1 : 1));
  }, [invoices]);

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Audit automatique
          <div className="flex gap-2">
            {errors > 0 && <Badge variant="destructive">{errors} erreur(s)</Badge>}
            {warnings > 0 && <Badge variant="warning">{warnings} avertissement(s)</Badge>}
            {issues.length === 0 && <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <Alert variant="success">
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>Aucune anomalie détectée. Toutes les taxes et taux de change semblent corrects.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {issues.map((issue, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border text-sm ${
                  issue.severity === "error"
                    ? "bg-red-50 border-red-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      issue.severity === "error" ? "text-red-500" : "text-yellow-500"
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{issue.company}</span>
                      <span className="text-muted-foreground text-xs">{issue.date}</span>
                      <Badge variant={issue.severity === "error" ? "destructive" : "warning"} className="text-xs">
                        {issue.type}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5">{issue.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
