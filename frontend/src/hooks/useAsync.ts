import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../utils/errors";

// Keyed reads never expose results from a previous wallet/chain/asset, even during render.
export function useAsync<T>(
  key: string,
  read: () => Promise<T>,
  enabled = true,
  keepPrevious = false,
) {
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
      data: keepPrevious ? previous.data : undefined,
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
  }, [key, enabled, retry, keepPrevious]);
  return {
    ...(enabled && state.key === key
      ? state
      : {
          data: enabled && keepPrevious ? state.data : undefined,
          error: undefined,
          loading: enabled,
        }),
    reload: () => setRetry((r) => r + 1),
  };
}
