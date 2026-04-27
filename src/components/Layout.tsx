import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ReceiptText, LayoutDashboard, FileText, FolderOpen, Users, LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const allNavItems = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, adminOnly: true },
  { to: "/rapport-impot", label: "Rapport fiscal", icon: FileText, adminOnly: true },
  { to: "/documents-fiscaux", label: "Documents fiscaux", icon: FolderOpen, adminOnly: true },
  { to: "/partenariat", label: "Partenariat", icon: Users, adminOnly: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const navItems = allNavItems.filter(({ adminOnly }) => !adminOnly || role === "admin");

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary">
              <ReceiptText className="w-5 h-5" />
              <span>Invoice Genius</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === to
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-t px-4 pb-2">
          <nav className="flex items-center gap-1 pt-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex-1 justify-center",
                  pathname === to
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
