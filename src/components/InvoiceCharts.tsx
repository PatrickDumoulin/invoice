import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPENSE_CATEGORY_LABELS, type Invoice } from "@/types";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#84cc16",
];

export function InvoiceCharts({ invoices }: { invoices: Invoice[] }) {
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; expenses: number }>();
    for (const inv of invoices) {
      if (!inv.invoice_date || !inv.amount_cad) continue;
      const key = inv.invoice_date.slice(0, 7);
      if (!map.has(key)) {
        const label = format(parseISO(inv.invoice_date), "MMM yyyy", { locale: fr });
        map.set(key, { month: label, revenue: 0, expenses: 0 });
      }
      const entry = map.get(key)!;
      if (inv.type === "revenue") entry.revenue += inv.amount_cad;
      else entry.expenses += inv.amount_cad;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [invoices]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.type !== "expense" || !inv.amount_cad || !inv.expense_category) continue;
      map.set(inv.expense_category, (map.get(inv.expense_category) ?? 0) + inv.amount_cad);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([cat, total]) => ({
        name: EXPENSE_CATEGORY_LABELS[cat as keyof typeof EXPENSE_CATEGORY_LABELS] ?? cat,
        value: Math.round(total * 100) / 100,
      }));
  }, [invoices]);

  const formatK = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k$` : `${v.toFixed(0)}$`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenus vs Dépenses par mois <span className="text-xs font-normal text-muted-foreground">(TTC)</span></CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                height={55}
              />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)} $`} />
              <Legend />
              <Bar dataKey="revenue" name="Revenus" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Dépenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dépenses par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              Aucune dépense catégorisée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toFixed(2)} $`} />
                <Legend
                  formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
