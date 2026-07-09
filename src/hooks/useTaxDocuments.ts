import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { TaxDocument } from "@/types";
import { toast } from "sonner";

export function useTaxDocuments() {
  return useQuery({
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
}

export function useUploadTaxDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      file: File;
      documentType: string;
      taxYear: number;
      quarter?: 1 | 2 | 3 | 4 | null;
      notes?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const ts = Date.now();
      const filePath = `${user.id}/${params.taxYear}/${ts}_${params.file.name}`;

      const { error: storageError } = await supabase.storage
        .from("tax-documents")
        .upload(filePath, params.file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("tax_documents").insert({
        user_id: user.id,
        file_name: params.file.name,
        file_path: filePath,
        document_type: params.documentType,
        tax_year: params.taxYear,
        quarter: params.quarter ?? null,
        notes: params.notes ?? null,
      });
      if (dbError) {
        await supabase.storage.from("tax-documents").remove([filePath]);
        throw dbError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax_documents"] }),
    onError: (err: Error) => toast.error(`Échec de l'envoi du document : ${err.message}`),
  });
}
