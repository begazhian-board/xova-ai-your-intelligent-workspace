import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { XovaWordmark } from "@/components/xova/Logo";
import { Mascot } from "@/components/xova/Mascot";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { useAppearance } from "@/lib/appearance";

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
        content: "A calmer workspace for ideas, answers and making things happen.",
      },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "xv-auth-input w-full rounded-xl border bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/75";

function AuthPage() {
  const { t, dir } = useI18n();
  const { theme, setAppearance } = useAppearance();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | "name" | null>(null);

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

  const resendConfirmation = async () => {
    const targetEmail = email.trim();
    if (!targetEmail || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast.success(t("auth.resendSent"));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("err.generic"));
    } finally {
      setResending(false);
    }
  };

  const isArabic = dir === "rtl";
  const mascotState = busy ? "thinking" : focused || email || password ? "lit" : "idle";
  const greeting = busy
    ? isArabic ? "ثواني بس… بجهّزلك كل حاجة." : "One moment… getting things ready."
    : mode === "signup"
      ? isArabic ? "أهلًا بيك! يلا نبدأ رحلتنا." : "Welcome aboard. Let’s get you started."
      : isArabic ? "نورت XOVA! جاهز نكمل؟" : "Good to see you. Ready when you are.";

  return (
    <main className="xv-auth-page min-h-screen px-4 py-5 sm:px-6 lg:px-10" dir={dir}>
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <XovaWordmark />
          <button
            type="button"
            onClick={() => setAppearance({ theme: theme === "dark" ? "light" : "dark" })}
            aria-label={theme === "dark" ? (isArabic ? "تفعيل الوضع النهاري" : "Switch to light mode") : (isArabic ? "تفعيل الوضع الليلي" : "Switch to dark mode")}
            className="xv-auth-theme-button inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface/80 text-muted-foreground transition hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-14">
          <section className="xv-auth-story relative hidden min-h-[560px] flex-col justify-between overflow-hidden rounded-[2rem] border border-border/70 p-10 lg:flex xl:p-12">
            <div className="xv-auth-orbit xv-auth-orbit-one" />
            <div className="xv-auth-orbit xv-auth-orbit-two" />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                {isArabic ? "مساحة عملك الذكية" : "YOUR INTELLIGENT WORKSPACE"}
              </span>
              <h1 className="mt-8 max-w-lg text-4xl font-semibold leading-[1.18] tracking-tight xl:text-5xl">
                {isArabic ? <>كل أفكارك،<br /><span className="xv-auth-gradient">في مكان واحد.</span></> : <>Your ideas deserve<br /><span className="xv-auth-gradient">a smarter space.</span></>}
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground xl:text-base">
                {isArabic
                  ? "اسأل، ابحث، اكتب، وابنِ. XOVA معاك من أول فكرة لحد آخر تفصيلة."
                  : "Ask, explore, write and build. Move from your first thought to the finished idea with XOVA."}
              </p>
            </div>

            <div className="relative z-10 mt-10 flex items-end gap-5">
              <div className="xv-auth-mascot-stage grid h-36 w-36 shrink-0 place-items-center rounded-[2rem] border border-brand/15 bg-brand/5">
                <Mascot state={mascotState} className="h-28 w-28" />
              </div>
              <div className="xv-auth-bubble mb-3 max-w-xs rounded-2xl rounded-bl-md border border-border bg-surface/90 px-4 py-3 shadow-lg">
                <p className="text-sm font-medium leading-6" aria-live="polite">{greeting}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isArabic ? "أنا هنا أساعدك." : "I’m here to help."}
                </p>
              </div>
            </div>
            <div className="relative z-10 mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px w-8 bg-brand/50" />
              {isArabic ? "فكّر بحرية. أنجز بذكاء." : "Think freely. Make it happen."}
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="xv-auth-card rounded-[1.75rem] border border-border/80 p-6 shadow-2xl sm:p-8">
              <div className="mb-7 flex items-center gap-3 lg:hidden">
                <div className="xv-auth-mascot-mini grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-brand/15 bg-brand/5">
                  <Mascot state={mascotState} className="h-14 w-14" />
                </div>
                <div>
                  <p className="text-sm font-semibold" aria-live="polite">{greeting}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{isArabic ? "أنا هنا أساعدك." : "I’m here to help."}</p>
                </div>
              </div>

              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                  {isArabic ? "مرحبًا بعودتك" : "WELCOME TO XOVA"}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[1.8rem]">
                  {mode === "signin" ? t("auth.title") : t("auth.signUp")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("auth.subtitle")}</p>
              </div>

              <div className="mb-6 grid grid-cols-2 rounded-xl bg-subtle p-1">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  aria-pressed={mode === "signin"}
                  className={`xv-auth-tab rounded-lg px-3 py-2.5 text-sm font-medium transition ${mode === "signin" ? "is-active" : "text-muted-foreground"}`}
                >
                  {t("auth.signIn")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  aria-pressed={mode === "signup"}
                  className={`xv-auth-tab rounded-lg px-3 py-2.5 text-sm font-medium transition ${mode === "signup" ? "is-active" : "text-muted-foreground"}`}
                >
                  {t("auth.signUp")}
                </button>
              </div>

              <form onSubmit={submit} className="flex flex-col gap-4">
                {mode === "signup" && (
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-foreground">{t("auth.name")}</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={() => setFocused("name")}
                      onBlur={() => setFocused(null)}
                      autoComplete="name"
                      className={inputClass}
                      placeholder={isArabic ? "اسمك" : "Your name"}
                    />
                  </label>
                )}
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-foreground">{t("auth.email")}</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    className={inputClass}
                    placeholder="name@example.com"
                    dir="ltr"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-foreground">{t("auth.password")}</span>
                  <span className="relative block">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      className={`${inputClass} ${isArabic ? "pl-12" : "pr-12"}`}
                      placeholder={isArabic ? "كلمة المرور" : "Your password"}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? (isArabic ? "إخفاء كلمة المرور" : "Hide password") : (isArabic ? "إظهار كلمة المرور" : "Show password")}
                      className={`xv-auth-eye absolute top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:text-foreground ${isArabic ? "left-2" : "right-2"}`}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="xv-auth-submit mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy
                    ? (isArabic ? "لحظة واحدة..." : "Please wait...")
                    : mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
                  {!busy && <ArrowRight className={`h-4 w-4 ${isArabic ? "rotate-180" : ""}`} />}
                </button>
              </form>

              {mode === "signin" && email.trim() && (
                <button
                  type="button"
                  onClick={() => void resendConfirmation()}
                  disabled={resending}
                  className="xv-focus mt-4 w-full rounded-xl border border-brand/20 bg-brand/5 px-3 py-3 text-xs font-medium text-brand transition hover:bg-brand/10 disabled:opacity-50"
                >
                  {resending ? t("state.processing") : t("auth.resendConfirmation")}
                </button>
              )}

              <p className="mt-6 text-center text-xs leading-6 text-muted-foreground">
                {isArabic
                  ? "بتسجيل الدخول، أنت بتبدأ مساحة عملك الخاصة مع XOVA."
                  : "Your workspace, conversations and preferences stay yours."}
              </p>
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} XOVA AI <span className="mx-1">·</span> {isArabic ? "من تطوير بجاد" : "by Begad"}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
