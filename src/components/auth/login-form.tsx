"use client";

import { LogIn } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { signIn } from "@/lib/auth/actions";
import { signInSchema } from "@/lib/auth/schema";
import { safeNextPath } from "@/lib/supabase/config";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [pending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const out: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "password" ? "password" : "email";
        out[key] ??= issue.message;
      }
      setErrors(out);
      (out.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const res = await signIn(parsed.data);
        if (res.ok) {
          // Recarga completa: nenhum estado da sessão anterior fica em memória.
          window.location.assign(safeNextPath(next));
          return;
        }
        setErrors(res.field ? { [res.field]: res.message } : { form: res.message });
        setPassword("");
        passwordRef.current?.focus();
      } catch {
        setErrors({ form: "Sem resposta do servidor. Verifique a conexão e tente novamente." });
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-describedby={errors.form ? "login-erro" : undefined}>
      <Field label="E-mail" error={errors.email}>
        {(p) => (
          <TextInput
            {...p}
            ref={emailRef}
            type="email"
            inputMode="email"
            autoComplete="username"
            spellCheck={false}
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field label="Senha" error={errors.password}>
        {(p) => <TextInput {...p} ref={passwordRef} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      {errors.form && (
        <p id="login-erro" role="alert" className="rounded-2xl border border-[rgba(217,103,123,0.4)] bg-[rgba(217,103,123,0.08)] px-4 py-2.5 text-[13px] text-ink">
          {errors.form}
        </p>
      )}
      <Button type="submit" variant="primary" size="md" loading={pending} className="mt-1 w-full justify-center">
        <LogIn aria-hidden /> {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
