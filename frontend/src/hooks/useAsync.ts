import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../utils/errors";

// Keyed reads never expose results from a previous wallet/chain/asset, even during render.
// keepPrevious: true keeps the last value across any key change (public data only);
// a string keeps it only while the previous key starts with that scope, e.g.
// "account:<session>:<fund>:", so a refresh does not flicker but a wallet change
// never shows the old account's data (AUD-009).
export function useAsync<T>(
  key: string,
  read: () => Promise<T>,
  enabled = true,
  keepPrevious: boolean | string = false,
) {
  const keeps = (previousKey: string) =>
    keepPrevious === true ||
    (typeof keepPrevious === "string" && previousKey.startsWith(keepPrevious));
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: string;
    loading: boolean;
  }>({ key: "", loading: true });
  const [retry, setRetry] = useState(0);
  const reader = useRef(read);
  reader.current = read;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((previous) => ({
      key,
      loading: true,
      data: keeps(previous.key) ? previous.data : undefined,
    }));
    reader
      .current()
      .then((data) => {
        if (!cancelled) setState({ key, data, loading: false });
      })
      .catch((error) => {
        if (!cancelled)
          setState({ key, error: errorMessage(error), loading: false });
      });
    return () => {
      cancelled = true;
    };
    // keeps() depends only on keepPrevious, which is in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, retry, keepPrevious]);
  return {
    ...(enabled && state.key === key
      ? state
      : {
          data: enabled && keeps(state.key) ? state.data : undefined,
          error: undefined,
          loading: enabled,
        }),
    reload: () => setRetry((r) => r + 1),
  };
}
