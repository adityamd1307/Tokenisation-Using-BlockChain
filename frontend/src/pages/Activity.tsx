import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useAssets } from "../context/DataContext";
import { useHistory } from "../hooks/data";
import { SelectField, TextField } from "../components/ui/forms";
import {
  EmptyState,
  ErrorNotice,
  PageHeader,
  Panel,
} from "../components/ui/layout";
import { ActivityTable } from "../components/ActivityTable";

/** Every labelled contract event across the registry, filterable. */
export default function Activity() {
  const assets = useAssets();
  const [params, setParams] = useSearchParams();
  const fundId = params.get("fund") ?? "all";
  const [type, setType] = useState("all"),
    [who, setWho] = useState("");
  const scope =
    fundId === "all"
      ? assets.data
      : assets.data?.filter((asset) => asset.id === fundId);
  const history = useHistory(scope);
  const types = [...new Set(history.data?.map((row) => row.type))].sort();
  const needle = who.trim().toLowerCase();
  const rows = history.data?.filter(
    (row) =>
      (type === "all" || row.type === type) &&
      (!needle ||
        [row.from, row.to, row.hash].some((v) =>
          v?.toLowerCase().includes(needle),
        )),
  );
  return (
    <div className="page">
      <PageHeader
        title="Activity"
        description="Events emitted by the factory, token and sale contracts since deployment. Contract logs are a technical record, not a legal ownership register."
        actions={
          <button className="btn btn--secondary" onClick={history.reload}>
            <RefreshCw aria-hidden />
            Refresh
          </button>
        }
      />
      {assets.error ? (
        <ErrorNotice message={assets.error} retry={assets.reload} />
      ) : (
        <Panel title="Event log" flush>
          <div className="toolbar">
            <SelectField
              label="Fund"
              value={fundId}
              onChange={(id) =>
                setParams(id === "all" ? {} : { fund: id }, { replace: true })
              }
              options={[
                { value: "all", label: "All funds" },
                ...(assets.data ?? []).map((asset) => ({
                  value: asset.id,
                  label: `${asset.name} (${asset.symbol})`,
                })),
              ]}
            />
            <SelectField
              label="Event type"
              value={type}
              onChange={setType}
              options={[
                { value: "all", label: "All event types" },
                ...types.map((t) => ({ value: t, label: t })),
              ]}
            />
            <TextField
              className="field--grow"
              label="Address or transaction"
              value={who}
              onChange={setWho}
              mono
              placeholder="0x…"
            />
          </div>
          <ActivityTable
            caption="Event log"
            rows={rows}
            loading={history.loading || assets.loading}
            error={history.error}
            retry={history.reload}
            empty={
              <EmptyState>
                {history.data?.length
                  ? "No events match these filters."
                  : "No contract events have been recorded yet."}
              </EmptyState>
            }
          />
        </Panel>
      )}
    </div>
  );
}
