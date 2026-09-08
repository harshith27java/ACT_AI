import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import DashboardPage from "@/pages/DashboardPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import DocumentDetailPage from "@/pages/DocumentDetailPage";
import TransformPage from "@/pages/TransformPage";
import TransformationDetailPage from "@/pages/TransformationDetailPage";
import ArtifactDetailPage from "@/pages/ArtifactDetailPage";
import ReviewQueuePage from "@/pages/ReviewQueuePage";
import SettingsPage from "@/pages/SettingsPage";
import ConfigError from "@/components/ConfigError";
import { isConfigured } from "@/lib/supabase";

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  if (!isConfigured) return <ConfigError />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
        <Route path="/transform" element={<TransformPage />} />
        <Route path="/transformations/:transformationId" element={<TransformationDetailPage />} />
        <Route path="/artifacts/:artifactId" element={<ArtifactDetailPage />} />
        <Route path="/review" element={<ReviewQueuePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
