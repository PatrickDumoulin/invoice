import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { computeHT, formatCurrency, formatDateShort } from "@/lib/utils";
import { EXPENSE_OWNERS, PARTNERSHIP_START_DATE, type Invoice, type PartnershipReimbursement } from "@/types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function PartnershipStats({ invoices }: { invoices: Invoice[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const qc = useQueryClient();

  const { data: reimbursements = [] } = useQuery({
    queryKey: ["partnership_reimbursements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partnership_reimbursements")
        .select("*")
        .order("reimbursement_date", { ascending: false });
      if (error) throw error;
      return data as PartnershipReimbursement[];
    },
  });

  const deleteReimbursement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partnership_reimbursements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partnership_reimbursements"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const partnershipInvoices = invoices.filter(
    (i) => i.is_partnership && i.invoice_date && i.invoice_date >= PARTNERSHIP_START_DATE
  );

  const revenues = partnershipInvoices.filter((i) => i.type === "revenue");
  const expenses = partnershipInvoices.filter((i) => i.type === "expense");

  const totalRevenue = revenues.reduce((s, i) => s + computeHT(i.amount_cad, i.tps_amount, i.tvq_amount), 0);

  const patrickExpenses = expenses
    .filter((i) => i.expense_owner === EXPENSE_OWNERS[0] || !i.expense_owner)
    .reduce((s, i) => s + computeHT(i.amount_cad, i.tps_amount, i.tvq_amount), 0);

  const partnerExpenses = expenses
    .filter((i) => i.expense_owner === EXPENSE_OWNERS[1])
    .reduce((s, i) => s + computeHT(i.amount_cad, i.tps_amount, i.tvq_amount), 0);

  const reimbursedToPatrick = reimbursements
    .filter((r) => !r.recipient || r.recipient === EXPENSE_OWNERS[0])
    .reduce((s, r) => s + r.amount, 0);

  const reimbursedToPartner = reimbursements
    .filter((r) => r.recipient === EXPENSE_OWNERS[1])
    .reduce((s, r) => s + r.amount, 0);

  const remainingToPatrick = Math.max(0, patrickExpenses - reimbursedToPatrick);
  const remainingToPartner = Math.max(0, partnerExpenses - reimbursedToPartner);

  const revenueSplit = totalRevenue / 2;
  const patrickPct = patrickExpenses > 0 ? Math.min(100, (reimbursedToPatrick / patrickExpenses) * 100) : 100;
  const partnerPct = partnerExpenses > 0 ? Math.min(100, (reimbursedToPartner / partnerExpenses) * 100) : 100;

  return (
    <div className="space-y-6">

      {/* Banner principal */}
      {remainingToPatrick > 0 ? (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-900">
            <span className="font-semibold">Patrick doit encore se rembourser {formatCurrency(remainingToPatrick)}</span>
            {" "}— {formatCurrency(patrickExpenses)} avancés, {formatCurrency(reimbursedToPatrick)} déjà récupérés.
          </AlertDescription>
        </Alert>
      ) : patrickExpenses > 0 ? (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-900 font-semibold">
            Patrick est entièrement remboursé de ses dépenses.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Revenus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revenus du partenariat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total revenus HT</span>
            <span className="font-bold text-green-600">{formatCurrency(totalRevenue)}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Part Patrick (50 %)</span>
            <span className="font-medium">{formatCurrency(revenueSplit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Part Partenaire (50 %)</span>
            <span className="font-medium">{formatCurrency(revenueSplit)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Remboursements par personne */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReimbursementTracker
          name="Patrick"
          expenses={patrickExpenses}
          reimbursed={reimbursedToPatrick}
          remaining={remainingToPatrick}
          pct={patrickPct}
          invoiceCount={expenses.filter((i) => i.expense_owner === EXPENSE_OWNERS[0] || !i.expense_owner).length}
        />
        <ReimbursementTracker
          name="Partenaire"
          expenses={partnerExpenses}
          reimbursed={reimbursedToPartner}
          remaining={remainingToPartner}
          pct={partnerPct}
          invoiceCount={expenses.filter((i) => i.expense_owner === EXPENSE_OWNERS[1]).length}
        />
      </div>

      {/* Historique des remboursements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Historique des remboursements</CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          {reimbursements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun remboursement enregistré.</p>
          ) : (
            <div className="space-y-2">
              {reimbursements.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{formatCurrency(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(r.reimbursement_date)}
                      {" · "}à {r.recipient ?? "Patrick"}
                      {r.notes && ` · ${r.notes}`}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 hover:text-destructive"
                    onClick={() => deleteReimbursement.mutate(r.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddReimbursementDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function ReimbursementTracker({
  name, expenses, reimbursed, remaining, pct, invoiceCount,
}: {
  name: string;
  expenses: number;
  reimbursed: number;
  remaining: number;
  pct: number;
  invoiceCount: number;
}) {
  const isDone = remaining <= 0;

  return (
    <Card className={isDone && expenses > 0 ? "border-green-200" : remaining > 0 ? "border-orange-200" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          {name}
          <Badge variant="outline">{invoiceCount} dépense(s)</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {expenses === 0 ? (
          <p className="text-muted-foreground text-xs">Aucune dépense avancée.</p>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dépenses avancées HT</span>
              <span className="font-medium text-red-600">{formatCurrency(expenses)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Déjà remboursé</span>
              <span className="font-medium text-purple-600">{formatCurrency(reimbursed)}</span>
            </div>

            {/* Barre de progression */}
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${isDone ? "bg-green-500" : "bg-orange-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{Math.round(pct)} % remboursé</p>
            </div>

            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Reste à rembourser</span>
              <span className={isDone ? "text-green-600" : "text-orange-600"}>
                {isDone ? "—" : formatCurrency(remaining)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AddReimbursementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [recipient, setRecipient] = useState<string>(EXPENSE_OWNERS[0]);
  const qc = useQueryClient();

  function handleClose() {
    setAmount(""); setNotes(""); setRecipient(EXPENSE_OWNERS[0]);
    setDate(new Date().toISOString().split("T")[0]);
    onClose();
  }

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const { error } = await supabase.from("partnership_reimbursements").insert({
        user_id: user.id,
        amount: parseFloat(amount),
        reimbursement_date: date,
        notes: notes || null,
        recipient,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partnership_reimbursements"] });
      toast.success("Remboursement ajouté");
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un remboursement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Destinataire</Label>
            <Select value={recipient} onValueChange={setRecipient}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Montant ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button onClick={() => add.mutate()} disabled={!amount || add.isPending}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
