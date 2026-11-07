import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useSelectedFund } from "../context/FundContext";
import { useFund } from "./data";

/** The fund named by the :id route parameter; also makes it the selected fund. */
export function useFundRoute() {
  const { id } = useParams();
  const state = useFund(id);
  const { select } = useSelectedFund();
  useEffect(() => {
    if (state.fund) select(state.fund.id);
  }, [state.fund, select]);
  return { ...state, id };
}
