import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { XovaWordmark } from "@/components/xova/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — XOVA AI" },
      {
        name: "description",
        content: "Sign in to XOVA AI to keep your conversation and preferences with your account.",
      },
      { property: "og:title", content: "Sign in — XOVA AI" },
      {
        property: "og:description",
        content: "Sign in to XOVA AI to keep your conversation and preferences with your account.",
      },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "xv-focus w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground";

function AuthPage() {
  const { t } = useI18n();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name.trim() || null },
          },
        });
        if (error) throw error;
        toast.success(t("auth.checkEmail"));
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/" });
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("err.generic"));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <XovaWordmark className="justify-center" />
        <h1 className="mt-6 text-center text-xl font-semibold tracking-[-0.01em]">
          {t("auth.title")}
        </h1>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">{t("auth.subtitle")}</p>

        <form onSubmit={submit} className="mt-7 flex flex-col gap-3">
          {mode === "signup" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("auth.name")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("auth.email")}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("auth.password")}</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="xv-focus mt-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="xv-focus mt-5 w-full rounded-lg py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? t("auth.toSignUp") : t("auth.toSignIn")}
        </button>
      </div>
    </main>
  );
}
