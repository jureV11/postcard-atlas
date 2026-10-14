"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils";
import { signInWithPassword, signUpWithPassword } from "./actions";

type Mode = "signin" | "signup" | "link" | "code";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    linkError
      ? "That sign-in link didn't work. Links only work in the browser window you requested them from — signing in with a password avoids this."
      : null,
  );

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setNotice(null);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const action = mode === "signup" ? signUpWithPassword : signInWithPassword;
      // On success the action redirects, so this only returns on error/notice.
      const result = await action(email, password, next);
      if (result?.error) setError(result.error);
      if (result?.notice) setNotice(result.notice);
    } catch (err) {
      // redirect() surfaces as a thrown navigation in some setups — let it through.
      if (errorMessage(err).includes("NEXT_REDIRECT")) throw err;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect.toString() },
    });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else switchMode("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      setError(errorMessage(error));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const emailField = (
    <div>
      <label className="label" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        className="input"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
    </div>
  );

  if (mode === "code") {
    return (
      <form onSubmit={verifyCode} className="card space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Check your email</h2>
          <p className="mt-1 text-sm text-ink-soft">
            We sent a sign-in link to <strong className="text-ink">{email}</strong>. Open it in this same browser
            window, or type the code from the email below if there is one.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="code">
            Code
          </label>
          <input
            id="code"
            className="input text-center font-mono text-xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn w-full" disabled={busy || code.length < 6}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button type="button" className="w-full text-sm text-ink-soft hover:text-ink" onClick={() => switchMode("signin")}>
          Back
        </button>
      </form>
    );
  }

  if (mode === "link") {
    return (
      <form onSubmit={sendLink} className="card space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Sign in with an email link</h2>
          <p className="mt-1 text-sm text-ink-soft">For when you&apos;ve forgotten your password.</p>
        </div>
        {emailField}
        {error && <p className="error">{error}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "Sending…" : "Email me a link"}
        </button>
        <button type="button" className="w-full text-sm text-ink-soft hover:text-ink" onClick={() => switchMode("signin")}>
          Back to password sign-in
        </button>
      </form>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-paper-deep p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`min-h-10 rounded-full text-sm font-medium transition ${
              mode === m ? "bg-white shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submitPassword} className="card space-y-4">
        {emailField}
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {isSignup && <p className="hint">At least 8 characters.</p>}
        </div>
        {error && <p className="error">{error}</p>}
        {notice && <p className="rounded-xl bg-paper px-3.5 py-2.5 text-sm">{notice}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "One moment…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <button type="button" className="w-full text-sm text-ink-soft hover:text-ink" onClick={() => switchMode("link")}>
        Forgot your password? Email me a link
      </button>
    </div>
  );
}
