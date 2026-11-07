"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * Lê/escreve parâmetros da URL (deep link de detalhes, filtros e visões).
 * Alterações feitas em sequência no mesmo ciclo são acumuladas, para que uma
 * não sobrescreva a outra antes de a navegação ser aplicada.
 */
export function useUrlParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<URLSearchParams | null>(null);

  useEffect(() => {
    pending.current = null;
  }, [params]);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = pending.current ?? new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      pending.current = next;
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return { params, setParams };
}
