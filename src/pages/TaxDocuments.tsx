import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { type TaxDocument } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const DOC_TYPE_LABELS: Record<string, string> = {
  t4a: "T4A",
  tps_tvh: "Confirmation TPS/TVH",
  t2: "T2 / Rapport annuel",
  releve: "Relevé Revenu Québec",
  autre: "Autre",
};

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

export function TaxDocuments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("autre");
  const [taxYear, setTaxYear] = useState(currentYear);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["tax_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TaxDocument[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: TaxDocument) => {
      await supabase.storage.from("tax-documents").remove([doc.file_path]);
      const { error } = await supabase.from("tax_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax_documents"] });
      toast.success("Document supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ts = Date.now();
      const filePath = `${user.id}/${taxYear}/${ts}_${file.name}`;

      const { error: storageError } = await supabase.storage
        .from("tax-documents")
        .upload(filePath, file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("tax_documents").insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        document_type: docType,
        tax_year: taxYear,
        notes: notes || null,
      });
      if (dbError) {
        await supabase.storage.from("tax-documents").remove([filePath]);
        throw dbError;
      }

      qc.invalidateQueries({ queryKey: ["tax_documents"] });
      toast.success(`${file.name} ajouté`);
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  async function downloadDoc(doc: TaxDocument) {
    const { data, error } = await supabase.storage
      .from("tax-documents")
      .download(doc.file_path);
    if (error || !data) { toast.error("Impossible de télécharger le fichier"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents fiscaux</h1>
        <p className="text-muted-foreground text-sm mt-1">
          T4A, confirmations d'inscription aux taxes, relevés et autres documents officiels
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Ajouter un document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Type de document</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Année fiscale</Label>
              <Select value={String(taxYear)} onValueChange={(v) => setTaxYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes (optionnel)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Reçu le 2025-03-15"
              />
            </div>
          </div>
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Envoi en cours…" : "Choisir un fichier"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Documents enregistrés ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Chargement…</div>
          ) : documents.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Aucun document fiscal enregistré
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Fichier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Année</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="whitespace-nowrap">Ajouté le</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium max-w-[240px] truncate">{doc.file_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {DOC_TYPE_LABELS[doc.document_type ?? "autre"] ?? doc.document_type ?? "Autre"}
                      </Badge>
                    </TableCell>
                    <TableCell>{doc.tax_year}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {doc.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(parseISO(doc.created_at), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Télécharger"
                          onClick={() => downloadDoc(doc)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 hover:text-destructive"
                          title="Supprimer"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(doc)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
