import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { WalletProviderContext, useWallet } from "./context/WalletContext";
import { DataProvider } from "./context/DataContext";
import { FundProvider } from "./context/FundContext";
import { TransactionProvider } from "./context/TransactionContext";
import { AppShell } from "./components/shell/AppShell";
import FundRegistry from "./pages/FundRegistry";
import FundOverview from "./pages/FundOverview";
import Subscribe from "./pages/Subscribe";
import AdminDashboard from "./pages/AdminDashboard";
import IssuerDashboard from "./pages/IssuerDashboard";
import InvestorPortfolio from "./pages/InvestorPortfolio";
import { EmptyState } from "./components/common";
import "./index.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
/** Phase 4 links used /assets/:id; keep them working. */
function LegacyAsset() {
  const { id } = useParams();
  return <Navigate to={`/funds/${id}`} replace />;
}
export function AppRoutes() {
  const { session } = useWallet();
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<FundRegistry />} />
        <Route path="funds/:id" element={<FundOverview />} />
        <Route path="funds/:id/subscribe" element={<Subscribe />} />
        <Route path="assets/:id" element={<LegacyAsset />} />
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
        <FundProvider>
          <TransactionProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TransactionProvider>
        </FundProvider>
      </DataProvider>
    </WalletProviderContext>
  );
}
