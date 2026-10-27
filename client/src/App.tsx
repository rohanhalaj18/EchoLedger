import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ArchiveProvider } from "@/context/ArchiveContext";
import { ToastProvider } from "@/context/ToastContext";
import { DashboardPage } from "@/pages/DashboardPage";
import { AddRecordingPage } from "@/pages/AddRecordingPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { RecordingDetailPage } from "@/pages/RecordingDetailPage";
import { ComparePage } from "@/pages/ComparePage";
import { ComparisonDetailPage } from "@/pages/ComparisonDetailPage";
import { ClaimExplorerPage } from "@/pages/ClaimExplorerPage";
import { ClaimDetailPage } from "@/pages/ClaimDetailPage";
import { ResearchMapPage } from "@/pages/ResearchMapPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  return null;
}

export function App() {
  return (
    <ArchiveProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="recordings/new" element={<AddRecordingPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="recordings/:recordingId" element={<RecordingDetailPage />} />
              <Route path="compare" element={<ComparePage />} />
              <Route path="comparisons/:comparisonId" element={<ComparisonDetailPage />} />
              <Route path="claims" element={<ClaimExplorerPage />} />
              <Route path="claims/:claimId" element={<ClaimDetailPage />} />
              <Route path="map" element={<ResearchMapPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ArchiveProvider>
  );
}
