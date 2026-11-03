import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { WalletProviderContext, useWallet } from "./context/WalletContext";
import { DataProvider } from "./context/DataContext";
import { TransactionProvider } from "./context/TransactionContext";
import { AppLayout } from "./components/AppLayout";
import Marketplace from "./pages/Marketplace";
import AssetPage from "./pages/AssetPage";
import AdminDashboard from "./pages/AdminDashboard";
import IssuerDashboard from "./pages/IssuerDashboard";
import InvestorPortfolio from "./pages/InvestorPortfolio";
import { EmptyState } from "./components/common";
import "./index.css";
export function AppRoutes() {
  const { session } = useWallet();
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Marketplace />} />
        <Route path="assets/:id" element={<AssetPage />} />
        <Route path="admin" element={<AdminDashboard key={session} />} />
        <Route path="issuer" element={<IssuerDashboard />} />
        <Route path="portfolio" element={<InvestorPortfolio />} />
        <Route path="investor" element={<Navigate to="/portfolio" replace />} />
        <Route
          path="*"
          element={
            <EmptyState title="Page not found">
              Use the navigation to return to your workspace.
            </EmptyState>
          }
        />
      </Route>
    </Routes>
  );
}
export default function App() {
  return (
    <WalletProviderContext>
      <DataProvider>
        <TransactionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TransactionProvider>
      </DataProvider>
    </WalletProviderContext>
  );
}
