import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/types";

export function RoleGuard({
  children,
  allowed,
  fallback = "/partenariat",
}: {
  children: ReactNode;
  allowed: AppRole[];
  fallback?: string;
}) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!role || !allowed.includes(role)) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
