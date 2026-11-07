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
import { EmptyState, PageHeader, Panel } from "./components/ui/layout";
import FundRegistry from "./pages/FundRegistry";
import FundOverview from "./pages/FundOverview";
import Subscribe from "./pages/Subscribe";
import Portfolio from "./pages/Portfolio";
import Transfer from "./pages/Transfer";
import Activity from "./pages/Activity";
import InvestorRegistry from "./pages/issuer/InvestorRegistry";
import Offering from "./pages/issuer/Offering";
import TokenControls from "./pages/issuer/TokenControls";
import CreateFund, { IssuerHome } from "./pages/issuer/CreateFund";
import Administration from "./pages/Administration";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";

/** Phase 4 links used /assets/:id; keep them working. */
function LegacyAsset() {
  const { id } = useParams();
  return <Navigate to={`/funds/${id}`} replace />;
}
function NotFound() {
  return (
    <div className="page">
      <PageHeader title="Page not found" />
      <Panel title="Nothing here">
        <EmptyState>Use the sidebar to return to a workspace.</EmptyState>
      </Panel>
    </div>
  );
}
export function AppRoutes() {
  const { session } = useWallet();
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<FundRegistry />} />
        <Route path="funds/:id" element={<FundOverview />} />
        <Route path="funds/:id/subscribe" element={<Subscribe />} />
        <Route path="funds/:id/transfer" element={<Transfer />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="activity" element={<Activity />} />
        <Route path="issuer" element={<IssuerHome />} />
        <Route path="issuer/create" element={<CreateFund />} />
        <Route path="issuer/:id/registry" element={<InvestorRegistry />} />
        <Route path="issuer/:id/offering" element={<Offering />} />
        <Route path="issuer/:id/controls" element={<TokenControls />} />
        <Route path="admin" element={<Administration key={session} />} />
        <Route path="assets/:id" element={<LegacyAsset />} />
        <Route path="investor" element={<Navigate to="/portfolio" replace />} />
        <Route path="*" element={<NotFound />} />
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
