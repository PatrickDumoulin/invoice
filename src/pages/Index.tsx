import { useState, useMemo } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { useAssets, computeCCA } from "@/hooks/useAssets";
import { InvoiceUploader } from "@/components/InvoiceUploader";
import { InvoiceTable } from "@/components/InvoiceTable";
import { DashboardKPIs } from "@/components/DashboardKPIs";
import { InvoiceCharts } from "@/components/InvoiceCharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { List, Upload, BarChart3 } from "lucide-react";

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

export function Index() {
  const [year, setYear] = useState(2026);
  const { data: invoices = [], isLoading, error } = useInvoices();
  const { data: assets = [] } = useAssets();

  const yearInvoices = useMemo(
    () => invoices.filter((i) => i.invoice_date && new Date(i.invoice_date).getFullYear() === year),
    [invoices, year]
  );

  const totalCCA = useMemo(
    () => assets.reduce((sum, asset) => sum + computeCCA(asset, year), 0),
    [assets, year]
  );

  if (error) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Erreur de chargement des factures. Vérifiez votre connexion Supabase.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {yearInvoices.length} facture(s) en {year} · {yearInvoices.filter((i) => i.status === "processed").length} traitée(s)
          </p>
        </div>
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
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <DashboardKPIs invoices={yearInvoices} totalCCA={totalCCA} />
      )}

      <Tabs defaultValue="factures">
        <TabsList>
          <TabsTrigger value="factures" className="gap-1.5">
            <List className="w-3.5 h-3.5" />
            Factures
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            Importer
          </TabsTrigger>
          <TabsTrigger value="graphiques" className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Graphiques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="factures" className="mt-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <InvoiceTable invoices={yearInvoices} />
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <InvoiceUploader existingInvoices={invoices} />
        </TabsContent>

        <TabsContent value="graphiques" className="mt-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <InvoiceCharts invoices={yearInvoices} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
