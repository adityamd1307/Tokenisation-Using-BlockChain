import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WalletProviderContext } from "../context/WalletContext";
import { DataProvider } from "../context/DataContext";
import { FundProvider } from "../context/FundContext";
import { TransactionProvider } from "../context/TransactionContext";
import { AppRoutes } from "../App";

/** Mounts the whole app at `path` with the same providers as production. */
export function renderApp(path = "/") {
  return render(
    <WalletProviderContext>
      <DataProvider>
        <FundProvider>
          <TransactionProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
            </MemoryRouter>
          </TransactionProvider>
        </FundProvider>
      </DataProvider>
    </WalletProviderContext>,
  );
}
