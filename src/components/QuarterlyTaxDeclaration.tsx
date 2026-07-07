import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCurrency, computeHT, isAfterDate } from "@/lib/utils";
import { TAX_REGISTRATION_DATE, type Invoice } from "@/types";
import { Info, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";

const QUARTER_LABELS = [
  "T1 — janvier à mars",
  "T2 — avril à juin",
  "T3 — juillet à septembre",
  "T4 — octobre à décembre",
];

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

interface QuarterPeriod {
  q: 1 | 2 | 3 | 4;
  label: string;
  start: Date;
  end: Date;
  deadline: Date;
}

function getQuarterPeriods(year: number): QuarterPeriod[] {
  return [1, 2, 3, 4].map((q) => {
    const startMonth = (q - 1) * 3;
    return {
      q: q as 1 | 2 | 3 | 4,
      label: QUARTER_LABELS[q - 1],
      start: new Date(year, startMonth, 1),
      end: new Date(year, startMonth + 3, 0),
      deadline: new Date(year, startMonth + 4, 0),
    };
  });
}

interface QuarterData {
  invoiceCount: number;
  excludedPreRegistration: number;
  line101: number;
  line103: number;
  line106: number;
  line109: number;
  line203: number;
  line206: number;
  line209: number;
  total: number;
}

function computeQuarterData(invoices: Invoice[], period: QuarterPeriod): QuarterData {
  const inQuarter = invoices.filter((i) => {
    if (!i.invoice_date) return false;
    const d = new Date(i.invoice_date);
    return d >= period.start && d <= period.end;
  });
  const taxable = inQuarter.filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE));
  const revenues = taxable.filter((i) => i.type === "revenue");
  const expenses = taxable.filter((i) => i.type === "expense");

  const line101 = revenues.reduce((s, i) => s + computeHT(i.amount_cad, i.tps_amount, i.tvq_amount), 0);
  const line103 = revenues.reduce((s, i) => s + (i.tps_amount ?? 0), 0);
  const line106 = expenses.reduce((s, i) => s + (i.tps_amount ?? 0), 0);
  const line109 = line103 - line106;
  const line203 = revenues.reduce((s, i) => s + (i.tvq_amount ?? 0), 0);
  const line206 = expenses.reduce((s, i) => s + (i.tvq_amount ?? 0), 0);
  const line209 = line203 - line206;

  return {
    invoiceCount: inQuarter.length,
    excludedPreRegistration: inQuarter.length - taxable.length,
    line101, line103, line106, line109, line203, line206, line209,
    total: line109 + line209,
  };
}

function statusOf(period: QuarterPeriod, today: Date): { label: string; variant: "outline" | "default" | "destructive" | "secondary" } {
  if (today < period.start) return { label: "À venir", variant: "outline" };
  if (today <= period.end) return { label: "En cours", variant: "secondary" };
  if (today <= period.deadline) return { label: `À produire — avant le ${fmtDate(period.deadline)}`, variant: "default" };
  return { label: `Échéance dépassée (${fmtDate(period.deadline)})`, variant: "destructive" };
}

function buildSummaryText(period: QuarterPeriod, data: QuarterData, year: number): string {
  const $ = (n: number) => formatCurrency(n);
  const verdict = data.total > 0.005
    ? `MONTANT À PAYER (case « Solde à remettre ») : ${$(data.total)}`
    : data.total < -0.005
    ? `REMBOURSEMENT DEMANDÉ (case « Remboursement demandé ») : ${$(-data.total)}`
    : `AUCUN MONTANT DÛ (solde à 0 $)`;

  return [
    `DÉCLARATION TPS/TVQ — ${period.label} ${year}`,
    `Période : du ${fmtDate(period.start)} au ${fmtDate(period.end)}`,
    `Échéance de production : ${fmtDate(period.deadline)}`,
    ``,
    `Ligne 101 — Total des fournitures (chiffre d'affaires, taxes exclues) : ${$(data.line101)}`,
    ``,
    `TPS/TVH`,
    `  Ligne 103 — TPS perçue : ${$(data.line103)}`,
    `  Ligne 106 — CTI (TPS payée sur achats) : ${$(data.line106)}`,
    `  Ligne 109 (= 113) — TPS nette : ${$(data.line109)}`,
    ``,
    `TVQ`,
    `  Ligne 203 — TVQ perçue : ${$(data.line203)}`,
    `  Ligne 206 — RTI (TVQ payée sur achats) : ${$(data.line206)}`,
    `  Ligne 209 (= 213) — TVQ nette : ${$(data.line209)}`,
    ``,
    verdict,
  ].join("\n");
}

function LineRow({ line, label, value, bold }: { line: string; label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>
        <span className="font-mono text-xs text-muted-foreground mr-1.5">L.{line}</span>
        {label}
      </span>
      <span className={bold ? "font-semibold" : ""}>{formatCurrency(value)}</span>
    </div>
  );
}

function QuarterCard({ period, data, year, today }: { period: QuarterPeriod; data: QuarterData; year: number; today: Date }) {
  const status = statusOf(period, today);
  const isRefund = data.total < -0.005;
  const isNil = Math.abs(data.total) <= 0.005;

  function copySummary() {
    navigator.clipboard.writeText(buildSummaryText(period, data, year));
    toast.success("Résumé copié — prêt à coller dans tes notes");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span>
            {period.label} {year}
            <span className="block text-xs font-normal text-muted-foreground mt-0.5">
              Du {fmtDate(period.start)} au {fmtDate(period.end)} · Échéance : {fmtDate(period.deadline)}
            </span>
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.excludedPreRegistration > 0 && (
          <Alert variant="warning">
            <Info className="w-4 h-4" />
            <AlertDescription>
              {data.excludedPreRegistration} facture(s) de cette période sont antérieures à l'inscription aux taxes
              (1er décembre 2025) et ne sont pas incluses.
            </AlertDescription>
          </Alert>
        )}

        <LineRow line="101" label="Total des fournitures (chiffre d'affaires, taxes exclues)" value={data.line101} />

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">TPS/TVH</p>
            <LineRow line="103" label="TPS perçue" value={data.line103} />
            <LineRow line="106" label="CTI (TPS sur achats)" value={data.line106} />
            <Separator className="my-1.5" />
            <LineRow line="109 / 113" label="TPS nette" value={data.line109} bold />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">TVQ</p>
            <LineRow line="203" label="TVQ perçue" value={data.line203} />
            <LineRow line="206" label="RTI (TVQ sur achats)" value={data.line206} />
            <Separator className="my-1.5" />
            <LineRow line="209 / 213" label="TVQ nette" value={data.line209} bold />
          </div>
        </div>

        <Separator />

        <div
          className={`rounded-lg p-3 flex items-center justify-between ${
            isNil ? "bg-muted" : isRefund ? "bg-green-50 dark:bg-green-950/30" : "bg-blue-50 dark:bg-blue-950/30"
          }`}
        >
          <div>
            <p className={`font-semibold ${isNil ? "" : isRefund ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400"}`}>
              {isNil ? "Aucun montant dû" : isRefund ? "Remboursement demandé" : "Solde à remettre"}
            </p>
            <p className="text-xs text-muted-foreground">Case du bordereau de paiement à remplir</p>
          </div>
          <p className={`text-xl font-bold ${isNil ? "" : isRefund ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400"}`}>
            {formatCurrency(Math.abs(data.total))}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={copySummary} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" />
          Copier le résumé (quoi écrire)
        </Button>
      </CardContent>
    </Card>
  );
}

function exportQuarterlyPDF(periods: QuarterPeriod[], dataByQuarter: QuarterData[], year: number) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210;
  const L = 15;
  const R = PW - 15;
  const CW = R - L;

  const $ = (n: number) => {
    const s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (n < 0 ? "-" : "") + s + " $";
  };

  periods.forEach((period, idx) => {
    const data = dataByQuarter[idx];
    if (idx > 0) doc.addPage();
    let y = 15;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`Declaration TPS/TVQ - ${period.label.replace("—", "-")} ${year}`, L, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Periode: du ${fmtDate(period.start)} au ${fmtDate(period.end)}  ·  Echeance: ${fmtDate(period.deadline)}`,
      L,
      y + 15
    );
    doc.setTextColor(0, 0, 0);
    y += 26;

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

    function row(line: string, label: string, value: number, bold = false) {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(9);
      doc.text(`Ligne ${line} — ${label}`, L + 3, y);
      doc.text($(value), R - 2, y, { align: "right" });
      y += 5.5;
    }

    function divider() {
      y += 1;
      doc.setDrawColor(180, 180, 180);
      doc.line(L, y, R, y);
      y += 3;
    }

    row("101", "Total des fournitures (chiffre d'affaires, taxes exclues)", data.line101, true);
    y += 3;

    secHeader("TPS/TVH");
    row("103", "TPS percue", data.line103);
    row("106", "CTI (TPS sur achats)", data.line106);
    divider();
    row("109 / 113", "TPS nette", data.line109, true);
    y += 3;

    secHeader("TVQ");
    row("203", "TVQ percue", data.line203);
    row("206", "RTI (TVQ sur achats)", data.line206);
    divider();
    row("209 / 213", "TVQ nette", data.line209, true);
    y += 5;

    const isRefund = data.total < -0.005;
    const isNil = Math.abs(data.total) <= 0.005;
    const label = isNil ? "Aucun montant du" : isRefund ? "Remboursement demande" : "Solde a remettre";
    const fill: [number, number, number] = isNil ? [235, 235, 235] : isRefund ? [219, 234, 202] : [219, 234, 254];
    doc.setFillColor(...fill);
    doc.rect(L, y, CW, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(label, L + 4, y + 8);
    doc.text($(Math.abs(data.total)), R - 4, y + 8, { align: "right" });
    y += 18;

    if (data.excludedPreRegistration > 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(150, 100, 0);
      doc.text(
        `${data.excludedPreRegistration} facture(s) anterieure(s) au 1er decembre 2025 exclues (avant inscription aux taxes).`,
        L,
        y
      );
      doc.setTextColor(0, 0, 0);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Invoice Genius — Declaration TPS/TVQ ${period.label} ${year}`, PW / 2, 290, { align: "center" });
    doc.setTextColor(0, 0, 0);
  });

  saveAs(doc.output("blob"), `declaration_tps_tvq_${year}.pdf`);
}

export function QuarterlyTaxDeclaration({ invoices, year }: { invoices: Invoice[]; year: number }) {
  const today = useMemo(() => new Date(), []);
  const periods = useMemo(() => getQuarterPeriods(year), [year]);
  const registrationDate = useMemo(() => new Date(TAX_REGISTRATION_DATE), []);

  const visiblePeriods = periods.filter((p) => p.end >= registrationDate);
  const dataByQuarter = visiblePeriods.map((p) => computeQuarterData(invoices, p));

  if (visiblePeriods.length === 0) {
    return (
      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          Aucune période de déclaration pour {year} — l'inscription aux taxes a eu lieu le{" "}
          {fmtDate(registrationDate)}.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          Chaque montant ci-dessous correspond exactement à une ligne du formulaire FPZ-500 de Revenu Québec
          (Déclaration de la TPS/TVH et de la TVQ). Reporte les valeurs aux mêmes numéros de ligne.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => exportQuarterlyPDF(visiblePeriods, dataByQuarter, year)}
        >
          <FileText className="w-3.5 h-3.5" />
          Exporter PDF (tous les trimestres)
        </Button>
      </div>

      {visiblePeriods.map((period, idx) => (
        <QuarterCard key={period.q} period={period} data={dataByQuarter[idx]} year={year} today={today} />
      ))}
    </div>
  );
}
