"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

export function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      if (res.ok) {
        const next = params.get("next") || "/";
        window.location.assign(next.startsWith("/") && !next.startsWith("//") ? next : "/");
        return;
      }
      setError("Incorrect password. Check it and try again.");
    } catch {
      setError("Connection problem. Try again in a moment.");
    }
    setPending(false);
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <label htmlFor="dashboard-password" className="block text-sm font-medium">
        Password
      </label>
      <div className="relative">
        <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          id="dashboard-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
      <button type="submit" disabled={pending || !password} className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
        {pending ? "Checking…" : "Open the dashboard"}
      </button>
    </form>
  );
}
