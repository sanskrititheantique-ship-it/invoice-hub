"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, {} as { error?: string });
  return (
    <form action={action}>
      <h1 style={{ fontSize: 30 }}>Invoice Hub</h1>
      <p className="muted" style={{ margin: 0 }}>Sign in to issue and manage invoices.</p>
      <input type="hidden" name="next" value={next} />
      <label className="f"><span>Email</span><input id="email" name="email" type="email" autoComplete="username" required /></label>
      <label className="f"><span>Password</span><input id="password" name="password" type="password" autoComplete="current-password" required /></label>
      {state?.error && <p className="err" role="alert" style={{ margin: 0 }}>{state.error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
