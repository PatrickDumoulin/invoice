import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { fmtDate, isoLocal, getQuarterPeriods, computeQuarterData, type QuarterPeriod, type QuarterData } from "@/lib/quarterlyTax";
import { TAX_REGISTRATION_DATE, type Invoice, type TaxFiling } from "@/types";
import { useTaxFilings, useMarkFiled, useUnmarkFiled } from "@/hooks/useTaxFilings";
import { Info, Copy, FileText, CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";

function statusOf(period: QuarterPeriod, today: Date): { label: string; variant: "outline" | "default" | "destructive" | "secondary" } {
  // Compare by local calendar day (not instant) so the whole last day of a period still
  // counts as "within" it — period.end/deadline are Date objects at 00:00:00 of that day.
  const todayISO = isoLocal(today);
  const deadlineISO = isoLocal(period.deadline);
  if (todayISO < period.startISO) return { label: "À venir", variant: "outline" };
  if (todayISO <= period.endISO) return { label: "En cours", variant: "secondary" };
  if (todayISO <= deadlineISO) return { label: `À produire — avant le ${fmtDate(period.deadline)}`, variant: "default" };
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
    `Étape "Fournitures" — Total des fournitures (chiffre d'affaires, taxes exclues) : ${$(data.line101)}`,
    ``,
    `Étape "Déclaration de la TPS/TVH"`,
    `  Ligne 105 — TPS/TVH exigible et redressements : ${$(data.line103)}`,
    `  Ligne 108 — CTI et redressements : ${$(data.line106)}`,
    `  Ligne 109 — TPS/TVH nette (calculée automatiquement par "Calculer") : ${$(data.line109)}`,
    ``,
    `Étape "Déclaration de la TVQ"`,
    `  Ligne 205 — TVQ exigible et redressements : ${$(data.line203)}`,
    `  Ligne 208 — RTI et redressements : ${$(data.line206)}`,
    `  Ligne 209 — TVQ nette (calculée automatiquement par "Calculer") : ${$(data.line209)}`,
    ``,
    `Les autres champs (135, 136, 1301, 111, 114, 115) ne s'appliquent pas à cette entreprise — laisse-les vides.`,
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

function QuarterCard({ period, data, year, today, filing }: { period: QuarterPeriod; data: QuarterData; year: number; today: Date; filing?: TaxFiling }) {
  const status = statusOf(period, today);
  const isRefund = data.total < -0.005;
  const isNil = Math.abs(data.total) <= 0.005;
  const markFiled = useMarkFiled();
  const unmarkFiled = useUnmarkFiled();

  const amountsChangedSinceFiling =
    filing != null &&
    (Math.abs((filing.net_tps ?? 0) - data.line109) > 0.01 || Math.abs((filing.net_tvq ?? 0) - data.line209) > 0.01);

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
          {filing ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Déclaré le {new Date(filing.filed_at).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" })}
            </Badge>
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {amountsChangedSinceFiling && (
          <Alert variant="warning">
            <Info className="w-4 h-4" />
            <AlertDescription>
              Les factures de cette période ont changé depuis la déclaration : à l'époque TPS {formatCurrency(filing!.net_tps ?? 0)} /
              TVQ {formatCurrency(filing!.net_tvq ?? 0)}, maintenant TPS {formatCurrency(data.line109)} / TVQ {formatCurrency(data.line209)}.
              Une déclaration de redressement pourrait être nécessaire.
            </AlertDescription>
          </Alert>
        )}

        {data.excludedPreRegistration > 0 && (
          <Alert variant="warning">
            <Info className="w-4 h-4" />
            <AlertDescription>
              {data.excludedPreRegistration} facture(s) de cette période sont antérieures à l'inscription aux taxes
              (1er décembre 2025) et ne sont pas incluses.
            </AlertDescription>
          </Alert>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-1">Étape « Fournitures » de Mon dossier</p>
          <LineRow line="101" label="Total des fournitures (chiffre d'affaires, taxes exclues)" value={data.line101} />
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Déclaration de la TPS/TVH</p>
            <LineRow line="105" label="TPS/TVH exigible et redressements" value={data.line103} />
            <LineRow line="108" label="CTI et redressements" value={data.line106} />
            <Separator className="my-1.5" />
            <LineRow line="109" label="TPS/TVH nette (auto — bouton « Calculer »)" value={data.line109} bold />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Déclaration de la TVQ</p>
            <LineRow line="205" label="TVQ exigible et redressements" value={data.line203} />
            <LineRow line="208" label="RTI et redressements" value={data.line206} />
            <Separator className="my-1.5" />
            <LineRow line="209" label="TVQ nette (auto — bouton « Calculer »)" value={data.line209} bold />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Les autres champs de Mon dossier (135, 136, 1301, 111, 114, 115) ne s'appliquent pas à cette entreprise — laisse-les vides.
        </p>

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

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copySummary} className="gap-1.5">
            <Copy className="w-3.5 h-3.5" />
            Copier le résumé (quoi écrire)
          </Button>

          {filing ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={unmarkFiled.isPending}
              onClick={() => unmarkFiled.mutate({ year, quarter: period.q })}
            >
              <Undo2 className="w-3.5 h-3.5" />
              Annuler la déclaration
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              disabled={markFiled.isPending}
              onClick={() => markFiled.mutate({ year, quarter: period.q, net_tps: data.line109, net_tvq: data.line209 })}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Marquer {period.label.split(" —")[0]} comme déclaré
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

async function exportQuarterlyPDF(periods: QuarterPeriod[], dataByQuarter: QuarterData[], year: number) {
  const [{ jsPDF }, { saveAs }] = await Promise.all([import("jspdf"), import("file-saver")]);
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

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Etape "Fournitures" de Mon dossier :', L, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
    row("101", "Total des fournitures (chiffre d'affaires, taxes exclues)", data.line101, true);
    y += 3;

    secHeader("Declaration de la TPS/TVH");
    row("105", "TPS/TVH exigible et redressements", data.line103);
    row("108", "CTI et redressements", data.line106);
    divider();
    row("109", "TPS/TVH nette (auto - bouton Calculer)", data.line109, true);
    y += 3;

    secHeader("Declaration de la TVQ");
    row("205", "TVQ exigible et redressements", data.line203);
    row("208", "RTI et redressements", data.line206);
    divider();
    row("209", "TVQ nette (auto - bouton Calculer)", data.line209, true);
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

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Autres champs de Mon dossier (135, 136, 1301, 111, 114, 115) : ne s'appliquent pas, laisser vides.", L, y);
    doc.setTextColor(0, 0, 0);
    y += 5;

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
  const { data: filings = [] } = useTaxFilings();

  const visiblePeriods = periods.filter((p) => p.endISO >= TAX_REGISTRATION_DATE);
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
          Chaque montant ci-dessous correspond à un champ précis dans Mon dossier (Revenu Québec) →
          Produire une déclaration de TPS/TVH et de TVQ. Copie les valeurs aux mêmes numéros de ligne,
          clique « Calculer » sur le site pour obtenir le montant net automatiquement.
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
        <QuarterCard
          key={period.q}
          period={period}
          data={dataByQuarter[idx]}
          year={year}
          today={today}
          filing={filings.find((f) => f.year === year && f.quarter === period.q)}
        />
      ))}
    </div>
  );
}
