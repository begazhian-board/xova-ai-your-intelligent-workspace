import { useEffect, useState } from "react";
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

type SectionId = "general" | "ai" | "chat" | "appearance" | "account" | "privacy" | "about";

const SECTIONS: SectionId[] = [
  "general",
  "ai",
  "chat",
  "appearance",
  "account",
  "privacy",
  "about",
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  email: string;
  onUpdate: (patch: Partial<Profile>) => Promise<{ error?: string }>;
  onDeleteConversation: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
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
  const { t } = useI18n();
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
      <DialogContent className="max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-hidden p-0 sm:w-auto">
        <DialogHeader className="border-b border-border px-4 py-3 text-start">
          <DialogTitle className="text-base">{t("settings.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[75vh] flex-col md:flex-row">
          <div className="flex gap-1 overflow-x-auto border-b border-border p-2 md:w-44 md:shrink-0 md:flex-col md:border-b-0 md:border-e">
            {SECTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSection(item)}
                aria-current={section === item}
                className={cn(
                  "xv-focus whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors md:text-start",
                  section === item
                    ? "bg-active text-foreground"
                    : "text-muted-foreground hover:bg-hover hover:text-foreground",
                )}
              >
                {t(`settings.${item}`)}
              </button>
            ))}
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto p-4">
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
                <Field label={t("settings.displayName")}>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
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
