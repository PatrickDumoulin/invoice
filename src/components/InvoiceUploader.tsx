import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useAnalyzeInvoice } from "@/hooks/useInvoices";
import { computeSHA256 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Invoice, InvoiceType } from "@/types";
import { EXPENSE_OWNERS } from "@/types";

interface UploadItem {
  file: File;
  id: string;
  type: InvoiceType;
  is_partnership: boolean;
  expense_owner: string;
  status: "pending" | "uploading" | "analyzing" | "done" | "error" | "duplicate";
  progress: number;
  error?: string;
  invoiceId?: string;
  duplicateOf?: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export function InvoiceUploader({ existingInvoices }: { existingInvoices: Invoice[] }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const analyze = useAnalyzeInvoice();

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newItems: UploadItem[] = Array.from(files)
        .filter((f) => ACCEPTED_TYPES.includes(f.type) || f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))
        .map((file) => ({
          file,
          id: crypto.randomUUID(),
          type: "expense" as InvoiceType,
          is_partnership: false,
          expense_owner: EXPENSE_OWNERS[0],
          status: "pending" as const,
          progress: 0,
        }));

      if (newItems.length === 0) {
        toast.error("Formats acceptés : PDF, images (JPEG/PNG/WebP), XLSX");
        return;
      }
      setItems((prev) => [...prev, ...newItems]);
    },
    []
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  async function processItem(item: UploadItem) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    updateItem(item.id, { status: "uploading", progress: 10 });

    try {
      const hash = await computeSHA256(item.file);

      const hashDuplicate = existingInvoices.find((inv) => inv.file_hash === hash);
      if (hashDuplicate) {
        updateItem(item.id, {
          status: "duplicate",
          error: `Fichier identique à « ${hashDuplicate.company_name ?? hashDuplicate.file_name} »`,
          duplicateOf: hashDuplicate.id,
        });
        return;
      }

      const timestamp = Date.now();
      const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user.id}/${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(filePath, item.file, { upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      updateItem(item.id, { progress: 50 });

      const { data: invoice, error: dbError } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          type: item.type,
          file_name: item.file.name,
          file_path: filePath,
          file_hash: hash,
          status: "pending",
          currency: "CAD",
          is_partnership: item.is_partnership,
          partnership_reimbursed: 0,
          expense_owner: item.expense_owner,
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      updateItem(item.id, { status: "analyzing", progress: 70, invoiceId: invoice.id });

      await analyze.mutateAsync(invoice.id);

      updateItem(item.id, { status: "done", progress: 100 });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      updateItem(item.id, { status: "error", error: message });
      toast.error(`Échec pour ${item.file.name}: ${message}`);
    }
  }

  async function processAll() {
    const pending = items.filter((i) => i.status === "pending");
    await Promise.allSettled(pending.map(processItem));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const processingCount = items.filter((i) => ["uploading", "analyzing"].includes(i.status)).length;

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium">Glissez vos factures ici</p>
        <p className="text-sm text-muted-foreground mt-1">PDF, JPEG, PNG, WebP, XLSX</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-3 bg-white">
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={item.status} />
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {item.status === "pending" && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Select
                        value={item.type}
                        onValueChange={(v) => updateItem(item.id, { type: v as InvoiceType })}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Dépense</SelectItem>
                          <SelectItem value="revenue">Revenu</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`partnership-${item.id}`}
                          checked={item.is_partnership}
                          onCheckedChange={(v) => updateItem(item.id, { is_partnership: v })}
                        />
                        <Label htmlFor={`partnership-${item.id}`} className="text-xs cursor-pointer">
                          Partenariat
                        </Label>
                      </div>
                      {item.is_partnership && (
                        <Select
                          value={item.expense_owner}
                          onValueChange={(v) => updateItem(item.id, { expense_owner: v })}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_OWNERS.map((o) => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {["uploading", "analyzing"].includes(item.status) && (
                    <div className="mt-2 space-y-1">
                      <Progress value={item.progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">
                        {item.status === "uploading" ? "Téléversement…" : "Analyse IA en cours…"}
                      </p>
                    </div>
                  )}

                  {item.error && (
                    <Alert variant={item.status === "duplicate" ? "warning" : "destructive"} className="mt-2 py-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <AlertDescription className="text-xs">{item.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={processAll}
              disabled={pendingCount === 0 || processingCount > 0}
              className="gap-2"
            >
              {processingCount > 0 ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Traitement…</>
              ) : (
                <><Upload className="w-4 h-4" /> Analyser ({pendingCount})</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setItems([])}
              disabled={processingCount > 0}
            >
              Tout effacer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UploadItem["status"] }) {
  switch (status) {
    case "pending": return <Badge variant="secondary">En attente</Badge>;
    case "uploading": return <Badge variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Upload</Badge>;
    case "analyzing": return <Badge variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" />IA</Badge>;
    case "done": return <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Traité</Badge>;
    case "duplicate": return <Badge variant="warning">Doublon</Badge>;
    case "error": return <Badge variant="destructive">Erreur</Badge>;
    default: return null;
  }
}
