import { useLocation, useNavigate } from "react-router-dom";
import type { Asset } from "../types";
import { SelectField } from "./ui/forms";

/** Switches the fund in the current fund-scoped route (/funds/:id/…, /issuer/:id/…). */
export function FundSwitcher({
  funds,
  current,
}: {
  funds: Asset[];
  current: Asset;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (funds.length < 2) return null;
  return (
    <SelectField
      label="Fund"
      value={current.id}
      onChange={(id) =>
        navigate(
          pathname.replace(
            /^\/(funds|issuer)\/[^/]+/,
            (_match, base: string) => `/${base}/${id}`,
          ),
        )
      }
      options={funds.map((fund) => ({
        value: fund.id,
        label: `${fund.name} (${fund.symbol})`,
      }))}
    />
  );
}
