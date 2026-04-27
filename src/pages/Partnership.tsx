import { useInvoices } from "@/hooks/useInvoices";
import { useAuth } from "@/hooks/useAuth";
import { PartnershipStats } from "@/components/PartnershipStats";
import { InvoiceTable } from "@/components/InvoiceTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PARTNERSHIP_START_DATE } from "@/types";
import { formatDate } from "@/lib/utils";
import { Info } from "lucide-react";

export function Partnership() {
  const { data: invoices = [], isLoading } = useInvoices();
  const { role } = useAuth();
  const isPartner = role === "partner";

  const partnershipInvoices = invoices.filter(
    (i) => i.is_partnership && i.invoice_date && i.invoice_date >= PARTNERSHIP_START_DATE
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Partenariat 50-50</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Depuis le {formatDate(PARTNERSHIP_START_DATE)} · {partnershipInvoices.length} facture(s)
          </p>
        </div>
        {isPartner && (
          <Badge variant="secondary" className="mt-1">Lecture seule</Badge>
        )}
      </div>

      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          Seules les factures marquées <strong>Partenariat</strong> et datées depuis le{" "}
          {formatDate(PARTNERSHIP_START_DATE)} sont incluses ici. Les revenus sont partagés 50-50.
          Les dépenses sont remboursées par le partenaire qui ne les a pas payées.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="sommaire">
        <TabsList>
          <TabsTrigger value="sommaire">Sommaire financier</TabsTrigger>
          <TabsTrigger value="factures">Factures du partenariat</TabsTrigger>
        </TabsList>

        <TabsContent value="sommaire" className="mt-4">
          <PartnershipStats invoices={invoices} />
        </TabsContent>

        <TabsContent value="factures" className="mt-4">
          <InvoiceTable invoices={partnershipInvoices} readOnly={isPartner} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
