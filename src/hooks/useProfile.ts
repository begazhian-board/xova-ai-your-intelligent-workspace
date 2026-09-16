import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cacheAppearance, readCachedAppearance } from "@/lib/theme";
import type {
  LanguageId,
  ModeId,
  PersonalityId,
  ResponseStyleId,
  ThemeChoice,
} from "@/lib/xova";

export interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  default_mode: ModeId;
  personality: PersonalityId;
  custom_personality: string | null;
  response_style: ResponseStyleId;
  language: LanguageId;
  theme: ThemeChoice;
  enter_to_send: boolean;
}

function fallbackProfile(userId: string): Profile {
  const cached = readCachedAppearance();
  return {
    id: userId,
    display_name: null,
    username: null,
    avatar_url: null,
    default_mode: "instant",
    personality: "friendly",
    custom_personality: null,
    response_style: "balanced",
    language: cached.lang,
    theme: cached.theme,
    enter_to_send: true,
  };
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("profile load", error.message);
        const next = (data as Profile | null) ?? fallbackProfile(userId);
        setProfile(next);
        cacheAppearance(next.theme, next.language);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const update = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return { error: "no-user" as const };
      setProfile((current) => (current ? { ...current, ...patch } : current));
      if (patch.theme || patch.language) {
        const merged = { ...(profile ?? fallbackProfile(userId)), ...patch };
        cacheAppearance(merged.theme, merged.language);
      }
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, ...patch }, { onConflict: "id" });
      if (error) {
        console.error("profile save", error.message);
        return { error: error.message };
      }
      return {};
    },
    [userId, profile],
  );

  return { profile, loading, update };
}
