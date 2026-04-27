import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SiteGate } from "@/components/SiteGate";
import { AuthGuard } from "@/components/AuthGuard";
import { RoleGuard } from "@/components/RoleGuard";
import { Layout } from "@/components/Layout";
import { Index } from "@/pages/Index";
import { TaxReport } from "@/pages/TaxReport";
import { TaxDocuments } from "@/pages/TaxDocuments";
import { Partnership } from "@/pages/Partnership";
import { NotFound } from "@/pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <SiteGate>
        <AuthGuard>
          <Layout>
            <Routes>
              <Route path="/" element={<RoleGuard allowed={["admin"]}><Index /></RoleGuard>} />
              <Route path="/rapport-impot" element={<RoleGuard allowed={["admin"]}><TaxReport /></RoleGuard>} />
              <Route path="/documents-fiscaux" element={<RoleGuard allowed={["admin"]}><TaxDocuments /></RoleGuard>} />
              <Route path="/partenariat" element={<RoleGuard allowed={["admin", "partner"]} fallback="/"><Partnership /></RoleGuard>} />
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Layout>
        </AuthGuard>
      </SiteGate>
    </BrowserRouter>
  );
}
