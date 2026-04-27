import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, isAfterDate } from "@/lib/utils";
import { TAX_REGISTRATION_DATE, type Invoice } from "@/types";
import { TrendingUp, TrendingDown, DollarSign, Receipt, AlertCircle, CheckCircle, BarChart2 } from "lucide-react";

interface DashboardKPIsProps {
  invoices: Invoice[];
  totalCCA?: number;
}

export function DashboardKPIs({ invoices, totalCCA = 0 }: DashboardKPIsProps) {
  const stats = useMemo(() => {
    const revenues = invoices.filter((i) => i.type === "revenue");
    const expenses = invoices.filter((i) => i.type === "expense");

    // HT = amount_cad - tps - tvq (même logique que le rapport d'impôt original)
    const revenueHT = revenues.reduce(
      (s, i) => s + (i.amount_cad ?? 0) - (i.tps_amount ?? 0) - (i.tvq_amount ?? 0),
      0
    );
    const expensesHT = expenses.reduce(
      (s, i) => s + (i.amount_cad ?? 0) - (i.tps_amount ?? 0) - (i.tvq_amount ?? 0),
      0
    );
    const revenueTTC = revenues.reduce((s, i) => s + (i.amount_cad ?? 0), 0);
    const expensesTTC = expenses.reduce((s, i) => s + (i.amount_cad ?? 0), 0);

    // Bénéfice net = Revenus HT - Dépenses HT - Amortissements
    const netIncome = revenueHT - expensesHT - totalCCA;

    // TPS/TVQ — seulement après la date d'inscription (1er déc 2025)
    const tpsCollected = revenues
      .filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE))
      .reduce((s, i) => s + (i.tps_amount ?? 0), 0);
    const tpsCTI = expenses
      .filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE))
      .reduce((s, i) => s + (i.tps_amount ?? 0), 0);
    const tvqCollected = revenues
      .filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE))
      .reduce((s, i) => s + (i.tvq_amount ?? 0), 0);
    const tvqRTI = expenses
      .filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE))
      .reduce((s, i) => s + (i.tvq_amount ?? 0), 0);

    const tpsNet = tpsCollected - tpsCTI;
    const tvqNet = tvqCollected - tvqRTI;

    const processed = invoices.filter((i) => i.status === "processed").length;
    const errors = invoices.filter((i) => i.status === "error").length;

    return {
      revenueHT, expensesHT, revenueTTC, expensesTTC, netIncome,
      tpsCollected, tpsCTI, tvqCollected, tvqRTI, tpsNet, tvqNet,
      totalCount: invoices.length, processed, errors,
    };
  }, [invoices, totalCCA]);

  const cards = useMemo(() => [
    {
      title: "Revenus HT",
      value: formatCurrency(stats.revenueHT),
      subtitle: `TTC : ${formatCurrency(stats.revenueTTC)}`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Dépenses HT",
      value: formatCurrency(stats.expensesHT),
      subtitle: `TTC : ${formatCurrency(stats.expensesTTC)}`,
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Bénéfice net",
      value: formatCurrency(stats.netIncome),
      subtitle: totalCCA > 0 ? `Amort. : ${formatCurrency(totalCCA)}` : undefined,
      icon: DollarSign,
      color: stats.netIncome >= 0 ? "text-blue-600" : "text-red-600",
      bg: stats.netIncome >= 0 ? "bg-blue-50" : "bg-red-50",
    },
    {
      title: "Factures",
      value: `${stats.processed} / ${stats.totalCount}`,
      subtitle: stats.errors > 0 ? `${stats.errors} erreur(s)` : "Toutes traitées",
      icon: stats.errors > 0 ? AlertCircle : CheckCircle,
      color: stats.errors > 0 ? "text-yellow-600" : "text-green-600",
      bg: stats.errors > 0 ? "bg-yellow-50" : "bg-green-50",
    },
    {
      title: "TPS nette à remettre",
      value: formatCurrency(stats.tpsNet),
      subtitle: `Perçue : ${formatCurrency(stats.tpsCollected)} | CTI : ${formatCurrency(stats.tpsCTI)}`,
      icon: Receipt,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "TVQ nette à remettre",
      value: formatCurrency(stats.tvqNet),
      subtitle: `Perçue : ${formatCurrency(stats.tvqCollected)} | RTI : ${formatCurrency(stats.tvqRTI)}`,
      icon: BarChart2,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ], [stats, totalCCA]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${card.bg}`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            {card.subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
