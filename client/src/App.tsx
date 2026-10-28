import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CycleProvider } from "./context/CycleContext";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { VoiceFlowPage } from "./pages/VoiceFlowPage";
import { VaultPage } from "./pages/VaultPage";
import { ChroniclePage } from "./pages/ChroniclePage";
import { InsightsPage } from "./pages/InsightsPage";
import { DiaryScannerPage } from "./pages/DiaryScannerPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <BrowserRouter>
      <CycleProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/voice" element={<VoiceFlowPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/chronicle" element={<ChroniclePage />} />
            <Route path="/vault" element={<VaultPage />} />
            <Route path="/scanner" element={<DiaryScannerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </CycleProvider>
    </BrowserRouter>
  );
}
