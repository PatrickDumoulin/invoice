import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { TaxFiling } from "@/types";
import { toast } from "sonner";

export function useTaxFilings() {
  return useQuery({
    queryKey: ["tax_filings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tax_filings").select("*");
      if (error) throw error;
      return data as TaxFiling[];
    },
  });
}

export function useMarkFiled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (filing: { year: number; quarter: 1 | 2 | 3 | 4; net_tps: number; net_tvq: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const { error } = await supabase
        .from("tax_filings")
        .upsert(
          { user_id: user.id, ...filing, filed_at: new Date().toISOString() },
          { onConflict: "user_id,year,quarter" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax_filings"] });
      toast.success("Trimestre marqué comme déclaré");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnmarkFiled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, quarter }: { year: number; quarter: 1 | 2 | 3 | 4 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const { error } = await supabase
        .from("tax_filings")
        .delete()
        .eq("user_id", user.id)
        .eq("year", year)
        .eq("quarter", quarter);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax_filings"] });
      toast.success("Déclaration annulée");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
