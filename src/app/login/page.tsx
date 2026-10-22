import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { SITE_TITLE } from "@/lib/constants";

export const metadata = { title: `Sign in · ${SITE_TITLE}` };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px] bg-card border border-border rounded-lg px-6 py-7">
        <img src="/quarkslab-logo.svg" alt="Quarkslab" className="h-8 w-auto" />
        <h1 className="text-lg font-semibold mt-6">LinkedIn reporting</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter the password you received to open the dashboard.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
