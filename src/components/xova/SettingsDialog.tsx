import { useEffect, useState } from "react";
import { BrainCircuit, Info, Mail, MessageCircle, MessagesSquare, Palette, Settings2, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfile";
import {
  MODES,
  PERSONALITIES,
  RESPONSE_STYLES,
  type LanguageId,
  type ModeId,
  type PersonalityId,
  type ResponseStyleId,
  type ThemeChoice,
} from "@/lib/xova";

type SectionId = "general" | "ai" | "chat" | "appearance" | "account" | "privacy" | "contact" | "about";

const SECTIONS: SectionId[] = [
  "general",
  "ai",
  "chat",
  "appearance",
  "account",
  "privacy",
  "contact",
  "about",
];


const SECTION_ICONS: Record<SectionId, LucideIcon> = {
  general: Settings2,
  ai: BrainCircuit,
  chat: MessagesSquare,
  appearance: Palette,
  account: UserRound,
  privacy: ShieldCheck,
  contact: MessageCircle,
  about: Info,
};

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  email: string;
  onUpdate: (patch: Partial<Profile>) => Promise<{ error?: string }>;
  onDeleteConversation: () => void;
}

function Field({
  label,
  children,
  description,
}: {
  label: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {description && <span className="text-xxs leading-relaxed text-faint">{description}</span>}
    </label>
  );
}

const inputClass =
  "xv-focus w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted-foreground";

function Choices<T extends string>({
  value,
  options,
  labelFor,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labelFor: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "xv-focus rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            value === option
              ? "border-brand bg-brand-soft text-brand"
              : "border-border text-muted-foreground hover:bg-hover hover:text-foreground",
          )}
        >
          {labelFor(option)}
        </button>
      ))}
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  profile,
  email,
  onUpdate,
  onDeleteConversation,
}: SettingsDialogProps) {
  const { t, lang } = useI18n();
  const [section, setSection] = useState<SectionId>("general");
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const [custom, setCustom] = useState(profile.custom_personality ?? "");

  useEffect(() => {
    setDisplayName(profile.display_name ?? "");
    setUsername(profile.username ?? "");
    setAvatar(profile.avatar_url ?? "");
    setCustom(profile.custom_personality ?? "");
  }, [profile]);

  const save = async (patch: Partial<Profile>) => {
    const { error } = await onUpdate(patch);
    if (error) toast.error(t("err.generic"));
    else toast.success(t("settings.saved"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="xv-settings-dialog max-h-[90vh] w-[calc(100vw-1rem)] max-w-4xl overflow-hidden rounded-3xl border border-border/70 p-0 shadow-float sm:w-auto">
        <DialogHeader className="xv-settings-header border-b border-border/70 px-5 py-4 text-start sm:px-6">
          <DialogTitle className="flex items-center gap-3 text-base font-bold">
            <span className="xv-settings-title-icon grid h-10 w-10 place-items-center rounded-xl">
              <Settings2 className="h-5 w-5" />
            </span>
            {t("settings.title")}
          </DialogTitle>
          <p className="mt-1 ps-[52px] text-xs leading-relaxed text-muted-foreground">
            {lang === "ar" ? "خصص تجربة XOVA بالطريقة اللي تناسبك." : "Personalize your XOVA workspace."}
          </p>
        </DialogHeader>

        <div className="xv-settings-layout flex max-h-[78vh] min-h-0 flex-col md:flex-row">
          <div className="xv-settings-nav flex gap-1 overflow-x-auto border-b border-border/70 p-2.5 md:w-52 md:shrink-0 md:flex-col md:gap-1.5 md:border-b-0 md:border-e md:p-3">
            {SECTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSection(item)}
                aria-current={section === item ? "page" : undefined}
                className={cn(
                  "xv-settings-nav-item xv-focus flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all md:w-full md:text-start",
                  section === item
                    ? "is-active bg-active text-foreground"
                    : "text-muted-foreground hover:bg-hover hover:text-foreground",
                )}
              >
                {(() => {
                  const Icon = SECTION_ICONS[item];
                  return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
                })()}
                <span>{item === "contact" ? (lang === "ar" ? "تواصل معي" : "Contact me") : t(`settings.${item}`)}</span>
              </button>
            ))}
          </div>

          <div className="xv-settings-content min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {section === "general" && (
              <div className="flex flex-col gap-5">
                <Field label={t("settings.language")}>
                  <Choices<LanguageId>
                    value={profile.language}
                    options={["en", "ar"]}
                    labelFor={(option) => (option === "en" ? "English" : "العربية")}
                    onChange={(language) => void save({ language })}
                  />
                </Field>
                <Field label={t("settings.theme")}>
                  <Choices<ThemeChoice>
                    value={profile.theme}
                    options={["dark", "light", "system"]}
                    labelFor={(option) => t(`settings.theme.${option}`)}
                    onChange={(theme) => void save({ theme })}
                  />
                </Field>
              </div>
            )}

            {section === "ai" && (
              <div className="flex flex-col gap-5">
                <Field label={t("settings.defaultMode")}>
                  <Choices<ModeId>
                    value={profile.default_mode}
                    options={MODES.map((mode) => mode.id)}
                    labelFor={(option) => t(`mode.${option}`)}
                    onChange={(default_mode) => void save({ default_mode })}
                  />
                </Field>
                <Field label={t("settings.personality")}>
                  <Choices<PersonalityId>
                    value={profile.personality}
                    options={PERSONALITIES}
                    labelFor={(option) => t(`personality.${option}`)}
                    onChange={(personality) => void save({ personality })}
                  />
                </Field>
                {profile.personality === "custom" && (
                  <Field label={t("settings.customPersonality")}>
                    <textarea
                      value={custom}
                      rows={4}
                      onChange={(event) => setCustom(event.target.value)}
                      onBlur={() => void save({ custom_personality: custom })}
                      placeholder={t("settings.customPersonality.ph")}
                      className={cn(inputClass, "resize-y")}
                    />
                  </Field>
                )}
                <Field label={t("settings.responseStyle")}>
                  <Choices<ResponseStyleId>
                    value={profile.response_style}
                    options={RESPONSE_STYLES}
                    labelFor={(option) => t(`settings.style.${option}`)}
                    onChange={(response_style) => void save({ response_style })}
                  />
                </Field>
              </div>
            )}

            {section === "chat" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm">{t("settings.enterToSend")}</span>
                  <Switch
                    checked={profile.enter_to_send}
                    onCheckedChange={(enter_to_send) => void save({ enter_to_send })}
                    aria-label={t("settings.enterToSend")}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium">{t("settings.history")}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t("settings.history.desc")}</p>
                  <button
                    type="button"
                    onClick={onDeleteConversation}
                    className="xv-focus mt-3 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    {t("settings.clearHistory")}
                  </button>
                </div>
              </div>
            )}

            {section === "appearance" && (
              <Field label={t("settings.theme")}>
                <Choices<ThemeChoice>
                  value={profile.theme}
                  options={["dark", "light", "system"]}
                  labelFor={(option) => t(`settings.theme.${option}`)}
                  onChange={(theme) => void save({ theme })}
                />
              </Field>
            )}

            {section === "account" && (
              <div className="flex flex-col gap-4">
                <Field
                  label={t("settings.displayName")}
                  description={t("settings.displayName.help")}
                >
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={48}
                    placeholder={t("settings.displayName.placeholder")}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("settings.username")}>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("settings.avatar")}>
                  <input
                    value={avatar}
                    onChange={(event) => setAvatar(event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("settings.email")}>
                  <input value={email} readOnly className={cn(inputClass, "text-muted-foreground")} />
                </Field>
                <button
                  type="button"
                  onClick={() =>
                    void save({
                      display_name: displayName.trim() || null,
                      username: username.trim() || null,
                      avatar_url: avatar.trim() || null,
                    })
                  }
                  className="xv-focus self-start rounded-lg bg-brand px-3.5 py-2 text-xs font-medium text-brand-foreground hover:opacity-90"
                >
                  {t("settings.save")}
                </button>
              </div>
            )}

            {section === "privacy" && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("settings.privacy.desc")}
              </p>
            )}


            {section === "contact" && (
              <div className="xv-settings-contact flex flex-col gap-5">
                <div>
                  <h3 className="text-base font-bold">
                    {lang === "ar" ? "تواصل معي" : "Contact me"}
                  </h3>
                  <p className="mt-1 max-w-xl text-xs leading-6 text-muted-foreground">
                    {lang === "ar"
                      ? "قنوات التواصل الرسمية الخاصة بمشروع XOVA."
                      : "Official contact channels for the XOVA project."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <article className="xv-settings-contact-card flex min-w-0 items-center gap-3 rounded-2xl border p-4">
                    <span className="xv-settings-contact-icon is-whatsapp grid h-12 w-12 shrink-0 place-items-center rounded-xl">
                      <MessageCircle className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">WhatsApp</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {lang === "ar" ? "قناة واتساب للمشروع" : "Project WhatsApp channel"}
                      </span>
                    </span>
                    <span className="xv-settings-contact-status rounded-full px-2 py-1 text-[10px] font-semibold">
                      {lang === "ar" ? "غير مفعّل" : "Not set"}
                    </span>
                  </article>

                  <article className="xv-settings-contact-card flex min-w-0 items-center gap-3 rounded-2xl border p-4">
                    <span className="xv-settings-contact-icon is-email grid h-12 w-12 shrink-0 place-items-center rounded-xl">
                      <Mail className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">Gmail</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {lang === "ar" ? "بريد إلكتروني للمشروع" : "Project email address"}
                      </span>
                    </span>
                    <span className="xv-settings-contact-status rounded-full px-2 py-1 text-[10px] font-semibold">
                      {lang === "ar" ? "غير مفعّل" : "Not set"}
                    </span>
                  </article>
                </div>

                <div className="xv-settings-contact-note rounded-2xl border px-4 py-3 text-xs leading-6 text-muted-foreground">
                  {lang === "ar"
                    ? "للحفاظ على الخصوصية، استخدم رقم واتساب وبريدًا مخصصين للتواصل العام مع المشروع، وبموافقة ولي أمرك. مش هننشر بياناتك الشخصية على الموقع."
                    : "For privacy, use dedicated public project contact details with a parent or guardian's approval. Personal contact details should not be published here."}
                </div>
              </div>
            )}

            {section === "about" && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  {t("app.name")} · {t("app.by")}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("settings.about.desc")}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
