import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Asset } from "@/types";
import { toast } from "sonner";

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data as Asset[];
    },
  });
}

export function useUpsertAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (asset: Partial<Asset> & { user_id: string; name: string; purchase_cost: number; purchase_date: string; depreciation_rate: number; work_proportion: number }) => {
      const { data, error } = await supabase
        .from("assets")
        .upsert(asset)
        .select()
        .single();
      if (error) throw error;
      return data as Asset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Actif sauvegardé");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Actif supprimé");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function computeCCA(asset: Asset, taxYear: number): number {
  const purchaseYear = new Date(asset.purchase_date).getFullYear();
  if (purchaseYear > taxYear) return 0;

  const rate = asset.depreciation_rate / 100;
  const proportion = asset.work_proportion / 100;
  let remainingCost = asset.purchase_cost;

  for (let year = purchaseYear; year < taxYear; year++) {
    const cca = year === purchaseYear ? remainingCost * rate * 0.5 : remainingCost * rate;
    remainingCost -= cca;
  }
  const currentYearCCA = purchaseYear === taxYear
    ? remainingCost * rate * 0.5
    : remainingCost * rate;

  return currentYearCCA * proportion;
}
