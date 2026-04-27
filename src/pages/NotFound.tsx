import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-6xl font-bold text-muted-foreground/30">404</p>
      <p className="text-xl font-semibold">Page introuvable</p>
      <p className="text-muted-foreground text-sm">Cette page n'existe pas.</p>
      <Button asChild className="gap-2">
        <Link to="/">
          <Home className="w-4 h-4" />
          Tableau de bord
        </Link>
      </Button>
    </div>
  );
}
