import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useUpdateInvoice, useDeleteInvoice, useAnalyzeInvoice } from "@/hooks/useInvoices";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_OWNERS, type Invoice, type ExpenseCategory, type InvoiceType } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Download, Trash2, RefreshCw, Edit2, ChevronUp, ChevronDown, Minus, Search, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

type SortField = "invoice_date" | "company_name" | "amount_cad" | "type";
type SortDir = "asc" | "desc";

export function InvoiceTable({ invoices, readOnly = false }: { invoices: Invoice[]; readOnly?: boolean }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "revenue">("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [partnershipFilter, setPartnershipFilter] = useState<"all" | "yes" | "no">("all");
  const [sortField, setSortField] = useState<SortField>("invoice_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);

  const update = useUpdateInvoice();
  const remove = useDeleteInvoice();
  const analyze = useAnalyzeInvoice();

  const categories = useMemo(() => {
    const cats = new Set(invoices.map((i) => i.expense_category).filter(Boolean));
    return Array.from(cats) as ExpenseCategory[];
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.company_name?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.file_name?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") list = list.filter((i) => i.type === typeFilter);
    if (catFilter !== "all") list = list.filter((i) => i.expense_category === catFilter);
    if (partnershipFilter === "yes") list = list.filter((i) => i.is_partnership);
    if (partnershipFilter === "no") list = list.filter((i) => !i.is_partnership);

    list.sort((a, b) => {
      let valA: string | number = a[sortField] ?? "";
      let valB: string | number = b[sortField] ?? "";
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      return sortDir === "asc" ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return list;
  }, [invoices, search, typeFilter, catFilter, partnershipFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  async function downloadFile(invoice: Invoice) {
    if (!invoice.file_path) return;
    const { data, error } = await supabase.storage.from("invoices").download(invoice.file_path);
    if (error || !data) { toast.error("Impossible de télécharger le fichier"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = invoice.file_name ?? "facture";
    a.click();
    URL.revokeObjectURL(url);
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <Minus className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const totalRevenues = filtered.filter((i) => i.type === "revenue").reduce((s, i) => s + (i.amount_cad ?? 0), 0);
  const totalExpenses = filtered.filter((i) => i.type === "expense").reduce((s, i) => s + (i.amount_cad ?? 0), 0);
  const missingAmount = invoices.filter((i) => i.status === "processed" && !i.amount_cad);

  return (
    <div className="space-y-4">
      {!readOnly && missingAmount.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertCircle className="w-4 h-4 shrink-0 text-yellow-600" />
          <span>
            <strong>{missingAmount.length} facture(s) traitée(s) sans montant</strong> — les totaux peuvent être incomplets. Utilisez &quot;Ré-analyser&quot; sur ces factures.
          </span>
        </div>
      )}
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="revenue">Revenus</SelectItem>
            <SelectItem value="expense">Dépenses</SelectItem>
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {EXPENSE_CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={partnershipFilter} onValueChange={(v) => setPartnershipFilter(v as typeof partnershipFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="yes">Partenariat</SelectItem>
            <SelectItem value="no">Hors partenariat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{filtered.length} facture(s)</span>
        <span className="text-green-600 font-medium">↑ {formatCurrency(totalRevenues)}</span>
        <span className="text-red-600 font-medium">↓ {formatCurrency(totalExpenses)}</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("invoice_date")}>
                <div className="flex items-center gap-1">Date <SortIcon field="invoice_date" /></div>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("company_name")}>
                <div className="flex items-center gap-1">Compagnie <SortIcon field="company_name" /></div>
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("type")}>
                <div className="flex items-center gap-1">Type <SortIcon field="type" /></div>
              </TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("amount_cad")}>
                <div className="flex items-center justify-end gap-1">Montant CAD <SortIcon field="amount_cad" /></div>
              </TableHead>
              <TableHead className="text-right">TPS</TableHead>
              <TableHead className="text-right">TVQ</TableHead>
              <TableHead>Partenariat</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Aucune facture trouvée
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invoice) => (
                <TableRow key={invoice.id} className={invoice.type === "revenue" ? "bg-green-50/30" : ""}>
                  <TableCell className="whitespace-nowrap">{formatDateShort(invoice.invoice_date)}</TableCell>
                  <TableCell className="font-medium max-w-[160px] truncate">{invoice.company_name ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {invoice.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={invoice.type === "revenue" ? "success" : "secondary"}>
                      {invoice.type === "revenue" ? "Revenu" : "Dépense"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {invoice.expense_category
                      ? EXPENSE_CATEGORY_LABELS[invoice.expense_category]
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div>{formatCurrency(invoice.amount_cad)}</div>
                    {invoice.currency !== "CAD" && (
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(invoice.amount, invoice.currency)} {invoice.currency}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {invoice.tps_amount ? formatCurrency(invoice.tps_amount) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {invoice.tvq_amount ? formatCurrency(invoice.tvq_amount) : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={invoice.is_partnership}
                      disabled={readOnly}
                      onCheckedChange={(checked) =>
                        !readOnly && update.mutate({ id: invoice.id, is_partnership: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!readOnly && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Modifier"
                          onClick={() => setEditingInvoice(invoice)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Télécharger"
                        onClick={() => downloadFile(invoice)}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {!readOnly && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Ré-analyser"
                            disabled={analyze.isPending}
                            onClick={() => analyze.mutate(invoice.id)}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:text-destructive"
                            title="Supprimer"
                            onClick={() => setDeletingInvoice(invoice)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingInvoice && (
        <EditDialog
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSave={(updates) => {
            update.mutate({ id: editingInvoice.id, ...updates });
            setEditingInvoice(null);
          }}
        />
      )}

      <Dialog open={!!deletingInvoice} onOpenChange={(o) => !o && setDeletingInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la facture</DialogTitle>
            <DialogDescription>
              Supprimer {deletingInvoice?.company_name ?? deletingInvoice?.file_name ?? "cette facture"} ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingInvoice(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => { remove.mutate(deletingInvoice!.id); setDeletingInvoice(null); }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: Invoice["status"] }) {
  if (status === "processed") return <Badge variant="success">Traité</Badge>;
  if (status === "error") return <Badge variant="destructive">Erreur</Badge>;
  return <Badge variant="secondary">En attente</Badge>;
}

function EditDialog({
  invoice,
  onClose,
  onSave,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSave: (updates: Partial<Invoice>) => void;
}) {
  const [form, setForm] = useState({
    company_name: invoice.company_name ?? "",
    invoice_date: invoice.invoice_date ?? "",
    amount: invoice.amount?.toString() ?? "",
    tps_amount: invoice.tps_amount?.toString() ?? "",
    tvq_amount: invoice.tvq_amount?.toString() ?? "",
    description: invoice.description ?? "",
    type: invoice.type,
    expense_category: invoice.expense_category ?? "",
    is_partnership: invoice.is_partnership,
    expense_owner: invoice.expense_owner ?? EXPENSE_OWNERS[0],
    currency: invoice.currency,
  });

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    const amount = form.amount ? parseFloat(form.amount) : null;
    const tps = form.tps_amount ? parseFloat(form.tps_amount) : null;
    const tvq = form.tvq_amount ? parseFloat(form.tvq_amount) : null;

    if (tps !== null && tps < 0) {
      toast.error("La TPS ne peut pas être négative");
      return;
    }
    if (tvq !== null && tvq < 0) {
      toast.error("La TVQ ne peut pas être négative");
      return;
    }
    if (amount !== null && form.currency === "CAD") {
      const ht = amount - (tps ?? 0) - (tvq ?? 0);
      if (ht < -0.01) {
        toast.error(`Montant HT invalide: ${ht.toFixed(2)} $ — les taxes dépassent le total`);
        return;
      }
    }

    onSave({
      company_name: form.company_name || null,
      invoice_date: form.invoice_date || null,
      amount,
      tps_amount: tps,
      tvq_amount: tvq,
      description: form.description || null,
      type: form.type as InvoiceType,
      expense_category: (form.expense_category as ExpenseCategory) || null,
      is_partnership: form.is_partnership,
      expense_owner: form.expense_owner || EXPENSE_OWNERS[0],
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la facture</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Compagnie</Label>
              <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={form.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Montant ({form.currency})</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Dépense</SelectItem>
                  <SelectItem value="revenue">Revenu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>TPS ($)</Label>
              <Input type="number" step="0.01" value={form.tps_amount} onChange={(e) => set("tps_amount", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>TVQ ($)</Label>
              <Input type="number" step="0.01" value={form.tvq_amount} onChange={(e) => set("tvq_amount", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Catégorie</Label>
            <Select value={form.expense_category} onValueChange={(v) => set("expense_category", v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="edit-partnership"
              checked={form.is_partnership}
              onCheckedChange={(v) => set("is_partnership", v)}
            />
            <Label htmlFor="edit-partnership">Partenariat</Label>
          </div>
          {form.is_partnership && (
            <div className="space-y-1">
              <Label>Propriétaire de la dépense</Label>
              <Select value={form.expense_owner} onValueChange={(v) => set("expense_owner", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave}>Sauvegarder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
