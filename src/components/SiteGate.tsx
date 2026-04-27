import { useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "ig_site_access";

export function SiteGate({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (token === "granted") setGranted(true);
    setChecking(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-site-password", {
        body: { password },
      });
      if (error) throw error;
      if (data?.valid) {
        sessionStorage.setItem(STORAGE_KEY, "granted");
        setGranted(true);
      } else {
        toast.error("Mot de passe incorrect");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;
  if (granted) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Invoice Genius</CardTitle>
          <CardDescription>Entrez le mot de passe pour accéder à l'application</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-password">Mot de passe</Label>
              <Input
                id="site-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Vérification…" : "Accéder"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
