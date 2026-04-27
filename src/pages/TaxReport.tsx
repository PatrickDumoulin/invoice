import { useState, useMemo } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { useAssets, computeCCA } from "@/hooks/useAssets";
import { TaxSummary } from "@/components/TaxSummary";
import { InvoiceAudit } from "@/components/InvoiceAudit";
import { InvoiceReconciliation } from "@/components/InvoiceReconciliation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { computeHT, formatCurrency, formatDateShort, isAfterDate } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABELS, TAX_REGISTRATION_DATE, type Invoice } from "@/types";
import { Download, FileText } from "lucide-react";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

export function TaxReport() {
  const [year, setYear] = useState(2026);
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: assets = [] } = useAssets();

  const yearInvoices = useMemo(
    () => invoices.filter((i) => i.invoice_date && new Date(i.invoice_date).getFullYear() === year),
    [invoices, year]
  );

  const totalCCA = useMemo(
    () => assets.reduce((sum, asset) => sum + computeCCA(asset, year), 0),
    [assets, year]
  );

  function exportPDF() {
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

    const totalRevenue = revenues.reduce(
      (s, i) => s + computeHT(i.amount_cad, i.tps_amount, i.tvq_amount), 0
    );
    const totalExpenses = expenses.reduce(
      (s, i) => s + computeHT(i.amount_cad, i.tps_amount, i.tvq_amount), 0
    );
    const beneficeNet = totalRevenue - totalExpenses - totalCCA;

    const catMap = new Map<string, { total: number; count: number; tps: number; tvq: number }>();
    for (const inv of expenses) {
      const cat = inv.expense_category ?? "non_categorise";
      const entry = catMap.get(cat) ?? { total: 0, count: 0, tps: 0, tvq: 0 };
      entry.total += computeHT(inv.amount_cad, inv.tps_amount, inv.tvq_amount);
      entry.count += 1;
      if (isAfterDate(inv.invoice_date, TAX_REGISTRATION_DATE)) {
        entry.tps += inv.tps_amount ?? 0;
        entry.tvq += inv.tvq_amount ?? 0;
      }
      catMap.set(cat, entry);
    }
    const categories = Array.from(catMap.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([cat, data]) => ({
        label: EXPENSE_CATEGORY_LABELS[cat as keyof typeof EXPENSE_CATEGORY_LABELS] ?? cat,
        ...data,
      }));

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PW = 210;
    const L = 15;
    const R = PW - 15;
    const CW = R - L;
    let y = 15;

    const $ = (n: number) => {
      const s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return (n < 0 ? "-" : "") + s + " $";
    };

    function secHeader(title: string) {
      doc.setFillColor(30, 58, 138);
      doc.rect(L, y, CW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(title, L + 3, y + 5);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    function row(label: string, value: string, bold = false, rgb?: [number, number, number]) {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(9);
      if (rgb) doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(label, L + 3, y);
      doc.text(value, R - 2, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 5.5;
    }

    function divider() {
      y += 1;
      doc.setDrawColor(180, 180, 180);
      doc.line(L, y, R, y);
      y += 3;
    }

    function box(label: string, value: string, positive: boolean) {
      doc.setFillColor(positive ? 219 : 254, positive ? 234 : 202, positive ? 254 : 202);
      doc.rect(L, y, CW, 9, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(positive ? 0 : 180, 0, positive ? 180 : 0);
      doc.text(label, L + 4, y + 6.5);
      doc.text(value, R - 4, y + 6.5, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 14;
    }

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`Rapport fiscal ${year}`, L, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const today = new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
    doc.text(`Invoice Genius  ·  Genere le ${today}`, L, y + 15);
    doc.setTextColor(0, 0, 0);
    y += 23;

    // TPS / TVQ
    secHeader("Sommaire TPS / TVQ");
    row("TPS collectee (revenus apres inscription)", $(tpsCollected), false, [0, 130, 0]);
    row("CTI - TPS sur depenses (deductible)", $(tpsCTI), false, [176, 0, 0]);
    divider();
    row("TPS nette a remettre", $(tpsNet), true, tpsNet >= 0 ? [0, 0, 180] : [0, 130, 0]);
    y += 2;
    row("TVQ collectee (revenus apres inscription)", $(tvqCollected), false, [0, 130, 0]);
    row("RTI - TVQ sur depenses (deductible)", $(tvqRTI), false, [176, 0, 0]);
    divider();
    row("TVQ nette a remettre", $(tvqNet), true, tvqNet >= 0 ? [0, 0, 180] : [0, 130, 0]);
    y += 3;
    box("Total taxes nettes a remettre", $(tpsNet + tvqNet), tpsNet + tvqNet >= 0);

    // Resume fiscal
    secHeader("Resume fiscal");
    row("Revenus nets HT", $(totalRevenue), false, [0, 130, 0]);
    row("Depenses nettes HT", $(totalExpenses), false, [176, 0, 0]);
    if (totalCCA > 0) {
      row("Amortissements (DPA)", $(totalCCA), false, [176, 0, 0]);
      for (const asset of assets) {
        const cca = computeCCA(asset, year);
        if (cca > 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(130, 130, 130);
          doc.text(`  · ${asset.name} (${asset.depreciation_rate}% x ${asset.work_proportion}% pro)`, L + 5, y);
          doc.text($(cca), R - 2, y, { align: "right" });
          doc.setTextColor(0, 0, 0);
          y += 4.5;
        }
      }
    }
    divider();
    box("Benefice net", $(beneficeNet), beneficeNet >= 0);

    // Detail categories
    secHeader("Detail par categorie - Depenses");
    const C: [number, number, number, number, number] = [L + 2, 102, 130, 158, R - 2];
    doc.setFillColor(235, 235, 235);
    doc.rect(L, y - 1.5, CW, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Categorie", C[0], y + 3.5);
    doc.text("Fact.", C[1], y + 3.5, { align: "right" });
    doc.text("Total HT", C[2], y + 3.5, { align: "right" });
    doc.text("CTI (TPS)", C[3], y + 3.5, { align: "right" });
    doc.text("RTI (TVQ)", C[4], y + 3.5, { align: "right" });
    y += 7;

    let sumTotal = 0, sumTPS = 0, sumTVQ = 0, sumCount = 0;
    for (const cat of categories) {
      if (y > 268) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(cat.label, C[0], y);
      doc.text(String(cat.count), C[1], y, { align: "right" });
      doc.text($(cat.total), C[2], y, { align: "right" });
      doc.text($(cat.tps), C[3], y, { align: "right" });
      doc.text($(cat.tvq), C[4], y, { align: "right" });
      sumTotal += cat.total; sumTPS += cat.tps; sumTVQ += cat.tvq; sumCount += cat.count;
      y += 5;
    }
    divider();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Total depenses", C[0], y);
    doc.text(String(sumCount), C[1], y, { align: "right" });
    doc.text($(sumTotal), C[2], y, { align: "right" });
    doc.text($(sumTPS), C[3], y, { align: "right" });
    doc.text($(sumTVQ), C[4], y, { align: "right" });
    y += 5;
    doc.text("Revenus totaux HT", C[0], y);
    doc.text(String(revenues.length), C[1], y, { align: "right" });
    doc.text($(totalRevenue), C[2], y, { align: "right" });

    // Page footer
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Invoice Genius — Rapport fiscal ${year} — Page ${p}/${pages}`, PW / 2, 290, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }

    saveAs(doc.output("blob"), `rapport_fiscal_${year}.pdf`);
  }

  function exportCSV() {
    const headers = [
      "Date", "Compagnie", "Type", "Catégorie", "Description",
      "Montant orig.", "Devise", "Taux change", "Montant CAD",
      "TPS", "TVQ", "Partenariat", "Statut"
    ];
    const rows = yearInvoices.map((i) => [
      i.invoice_date ?? "",
      i.company_name ?? "",
      i.type === "revenue" ? "Revenu" : "Dépense",
      i.expense_category ? EXPENSE_CATEGORY_LABELS[i.expense_category] : "",
      i.description ?? "",
      i.amount?.toString() ?? "",
      i.currency,
      i.exchange_rate?.toString() ?? "1",
      i.amount_cad?.toString() ?? "",
      i.tps_amount?.toString() ?? "0",
      i.tvq_amount?.toString() ?? "0",
      i.is_partnership ? "Oui" : "Non",
      i.status,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `rapport_fiscal_${year}.csv`);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rapport fiscal</h1>
          <p className="text-muted-foreground text-sm mt-1">{yearInvoices.length} facture(s) pour {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {YEARS.map((y) => (
              <Button
                key={y}
                variant={year === y ? "default" : "outline"}
                size="sm"
                onClick={() => setYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Exporter PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exporter CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sommaire">
        <TabsList>
          <TabsTrigger value="sommaire">Sommaire taxes</TabsTrigger>
          <TabsTrigger value="amortissement">Amortissement (DPA)</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="reconciliation">Réconciliation</TabsTrigger>
          <TabsTrigger value="detail">Détail par catégorie</TabsTrigger>
        </TabsList>

        <TabsContent value="sommaire" className="mt-4">
          <TaxSummary invoices={yearInvoices} year={year} totalCCA={totalCCA} />
        </TabsContent>

        <TabsContent value="amortissement" className="mt-4">
          <DepreciationTab assets={assets} year={year} totalCCA={totalCCA} />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <InvoiceAudit invoices={yearInvoices} />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4">
          <InvoiceReconciliation invoices={yearInvoices} />
        </TabsContent>

        <TabsContent value="detail" className="mt-4">
          <CategoryBreakdown invoices={yearInvoices} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DepreciationTab({
  assets,
  year,
  totalCCA,
}: {
  assets: ReturnType<typeof useAssets>["data"] extends undefined ? never[] : NonNullable<ReturnType<typeof useAssets>["data"]>;
  year: number;
  totalCCA: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex justify-between items-center">
          Déduction pour amortissement (DPA) — {year}
          <Badge variant="outline">Total: {formatCurrency(totalCCA)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun actif enregistré.</p>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => {
              const cca = computeCCA(asset, year);
              return (
                <div key={asset.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Acheté le {formatDateShort(asset.purchase_date)} · Coût: {formatCurrency(asset.purchase_cost)} ·
                        Taux DPA: {asset.depreciation_rate}% · Usage pro: {asset.work_proportion}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{formatCurrency(cca)}</p>
                      <p className="text-xs text-muted-foreground">DPA {year}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total DPA déductible {year}</span>
              <span className="text-blue-600">{formatCurrency(totalCCA)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryBreakdown({ invoices }: { invoices: Invoice[] }) {
  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; count: number; tps: number; tvq: number }>();
    for (const inv of invoices) {
      if (inv.type !== "expense") continue;
      const cat = inv.expense_category ?? "non_categorise";
      const entry = map.get(cat) ?? { total: 0, count: 0, tps: 0, tvq: 0 };
      entry.total += computeHT(inv.amount_cad, inv.tps_amount, inv.tvq_amount);
      entry.count += 1;
      // CTI/RTI uniquement pour les factures après inscription aux taxes
      if (isAfterDate(inv.invoice_date, TAX_REGISTRATION_DATE)) {
        entry.tps += inv.tps_amount ?? 0;
        entry.tvq += inv.tvq_amount ?? 0;
      }
      map.set(cat, entry);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([cat, data]) => ({
        cat,
        label: EXPENSE_CATEGORY_LABELS[cat as keyof typeof EXPENSE_CATEGORY_LABELS] ?? cat,
        ...data,
      }));
  }, [invoices]);

  const revenues = invoices.filter((i) => i.type === "revenue");
  const totalRevenue = revenues.reduce((s, i) => s + (i.amount_cad ?? 0), 0);
  const totalExpenses = byCategory.reduce((s, c) => s + c.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Détail par catégorie — Dépenses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Catégorie</th>
                <th className="text-right py-2 font-medium"># Factures</th>
                <th className="text-right py-2 font-medium">Total HT</th>
                <th className="text-right py-2 font-medium">CTI (TPS)</th>
                <th className="text-right py-2 font-medium">RTI (TVQ)</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(({ cat, label, total, count, tps, tvq }) => (
                <tr key={cat} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2">{label}</td>
                  <td className="text-right py-2 text-muted-foreground">{count}</td>
                  <td className="text-right py-2 font-medium">{formatCurrency(total)}</td>
                  <td className="text-right py-2">{formatCurrency(tps)}</td>
                  <td className="text-right py-2">{formatCurrency(tvq)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="py-2">Total dépenses</td>
                <td className="text-right py-2">{byCategory.reduce((s, c) => s + c.count, 0)}</td>
                <td className="text-right py-2 text-red-600">{formatCurrency(totalExpenses)}</td>
                <td className="text-right py-2">{formatCurrency(byCategory.reduce((s, c) => s + c.tps, 0))}</td>
                <td className="text-right py-2">{formatCurrency(byCategory.reduce((s, c) => s + c.tvq, 0))}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-2">Revenus totaux</td>
                <td className="text-right py-2 text-muted-foreground">
                  {revenues.length}
                </td>
                <td className="text-right py-2 text-green-600">{formatCurrency(totalRevenue)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
