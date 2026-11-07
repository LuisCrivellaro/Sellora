"use client";

import { useCallback, useRef, useState } from "react";
import type { z } from "zod";
import { fieldErrors } from "@/lib/schemas";

/**
 * Estado de formulário mínimo com validação Zod no envio.
 * Erros aparecem junto ao campo; o foco vai para o primeiro inválido.
 */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  const reset = useCallback((next: T) => {
    setValues(next);
    setErrors({});
  }, []);

  /** Valida; em caso de erro, mostra mensagens e foca o primeiro campo inválido. */
  function validate<S extends z.ZodType>(schema: S, data: unknown = values): z.infer<S> | null {
    const result = schema.safeParse(data);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    const errs = fieldErrors(result.error);
    setErrors(errs);
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]");
      el?.focus();
    });
    return null;
  }

  return { values, set, errors, setErrors, reset, validate, formRef };
}
