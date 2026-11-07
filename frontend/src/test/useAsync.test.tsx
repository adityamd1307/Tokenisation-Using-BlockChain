// AUD-009: a scoped read keeps its value while refreshing within the same wallet
// session, but never shows a previous session's data.
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAsync } from "../hooks/useAsync";

describe("Scoped useAsync", () => {
  it("keeps data across a refresh in scope and drops it when the scope changes", async () => {
    let resolve!: (value: string) => void;
    const read = (value: string) => () =>
      value === "pending"
        ? new Promise<string>((r) => {
            resolve = r;
          })
        : Promise.resolve(value);
    const { result, rerender } = renderHook(
      ({ session, revision, value }) =>
        useAsync(
          `account:${session}:0:${revision}`,
          read(value),
          true,
          `account:${session}:0:`,
        ),
      { initialProps: { session: 1, revision: 0, value: "first" } },
    );
    await waitFor(() => expect(result.current.data).toBe("first"));
    rerender({ session: 1, revision: 1, value: "pending" });
    expect(result.current).toMatchObject({ data: "first", loading: true });
    resolve("refreshed");
    await waitFor(() => expect(result.current.data).toBe("refreshed"));
    rerender({ session: 2, revision: 1, value: "pending" });
    expect(result.current.data).toBeUndefined();
  });
});
