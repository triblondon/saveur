"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "@/components/styles/auth-form.module.css";

type Mode = "register" | "login";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLabel = useMemo(() => {
    if (submitting) {
      return mode === "register" ? "Creating account..." : "Signing in...";
    }
    return mode === "register" ? "Register" : "Sign in";
  }, [mode, submitting]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const payload =
      mode === "register"
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Authentication failed");
      }

      const nextPath = searchParams.get("next")?.trim();
      router.push((nextPath || "/") as never);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={`card ${styles.form}`} onSubmit={onSubmit}>
      <h2 className={styles.heading}>{mode === "register" ? "Create account" : "Sign in"}</h2>
      <p className="muted">
        {mode === "register"
          ? "Registration uses email and password only."
          : "Use your registered email and password."}
      </p>

      {mode === "register" ? (
        <label>
          Name
          <input
            required
            value={name}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      ) : null}

      <label>
        Email
        <input
          required
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label>
        Password
        <input
          required
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitLabel}
      </button>

      <p className="muted">
        {mode === "register" ? "Already registered?" : "Need an account?"}{" "}
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setMode(mode === "register" ? "login" : "register")}
          disabled={submitting}
        >
          {mode === "register" ? "Login" : "Register"}
        </button>
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
    </form>
  );
}
