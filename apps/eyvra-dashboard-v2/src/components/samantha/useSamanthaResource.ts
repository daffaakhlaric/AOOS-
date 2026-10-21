"use client";
import { useEffect, useState } from "react";
/** Each panel settles independently; a failed source cannot erase the others. */
export function useSamanthaResource<T>(url: string, revision: number) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    setState({});
    fetch(url, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error?.message ?? "Data belum dapat dimuat.");
        if (!controller.signal.aborted) setState({ data: body });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState({ error: e instanceof Error ? e.message : "Data belum dapat dimuat." });
      });
    return () => controller.abort();
  }, [url, revision]);
  return state;
}
