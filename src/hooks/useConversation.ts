import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Attachment, ChatMessage, ModeId, SourceRef } from "@/lib/xova";
import { newId } from "@/lib/xova";

const SOURCES_PREFIX = "\u241E SOURCES ";

interface SendOptions {
  text: string;
  attachments: Attachment[];
  mode: ModeId;
}

interface AiConfig {
  personality: string;
  customPersonality?: string | null;
  responseStyle: string;
  language: string;
}

interface DbRow {
  id: string;
  role: string;
  content: string;
  attachments: unknown;
  sources: unknown;
  image_url: string | null;
  mode: string | null;
  created_at: string;
}

function rowToMessage(row: DbRow): ChatMessage {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    attachments: Array.isArray(row.attachments) ? (row.attachments as Attachment[]) : [],
    sources: Array.isArray(row.sources) ? (row.sources as SourceRef[]) : [],
    imageUrl: row.image_url,
    mode: (row.mode as ModeId | null) ?? null,
    createdAt: row.created_at,
  };
}

/** Attachments are stripped of heavy payloads before persisting. */
function persistableAttachments(attachments: Attachment[]) {
  return attachments.map((a) => ({
    id: a.id,
    name: a.name,
    mime: a.mime,
    size: a.size,
    kind: a.kind,
    dataUrl: a.kind === "image" ? a.dataUrl : undefined,
  }));
}

export function useConversation(userId: string | undefined, config: AiConfig) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [status, setStatus] = useState<"idle" | "submitted" | "streaming" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!userId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data, error: dbError }) => {
        if (!active) return;
        if (dbError) console.error("messages load", dbError.message);
        setMessages(((data as DbRow[] | null) ?? []).map(rowToMessage));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const persist = useCallback(
    async (message: ChatMessage) => {
      if (!userId) return;
      const { error: dbError } = await supabase.from("messages").insert({
        id: message.id,
        user_id: userId,
        role: message.role,
        content: message.content,
        attachments: JSON.parse(
          JSON.stringify(persistableAttachments(message.attachments)),
        ) as never,
        sources: JSON.parse(JSON.stringify(message.sources)) as never,
        image_url: message.imageUrl ?? null,
        mode: message.mode ?? null,
        created_at: message.createdAt,
      });
      if (dbError) console.error("message save", dbError.message);
    },
    [userId],
  );

  const runCompletion = useCallback(
    async (history: ChatMessage[], mode: ModeId) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setNotice(null);
      setStatus("submitted");

      const assistantId = newId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        attachments: [],
        sources: [],
        mode,
        createdAt: new Date().toISOString(),
        streaming: true,
      };
      setMessages((current) => [...current, assistantMessage]);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("err.auth");

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          signal: controller.signal,
          body: JSON.stringify({
            mode,
            personality: configRef.current.personality,
            customPersonality: configRef.current.customPersonality,
            responseStyle: configRef.current.responseStyle,
            language: configRef.current.language,
            messages: history.map((message) => ({
              role: message.role,
              content: message.content,
              attachments: message.attachments,
            })),
          }),
        });

        if (!response.ok || !response.body) {
          let code = "err.unavailable";
          try {
            const json = (await response.json()) as { error?: string };
            if (json.error) code = json.error;
          } catch {
            /* non-JSON error */
          }
          throw new Error(code);
        }

        if (mode === "research" && response.headers.get("X-Xova-Search") !== "live") {
          setNotice("err.searchOffline");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let text = "";
        let sources: SourceRef[] = [];
        let preludeDone = false;

        setStatus("streaming");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          if (!preludeDone) {
            const newline = buffer.indexOf("\n");
            if (newline === -1) continue;
            const head = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            preludeDone = true;
            if (head.startsWith(SOURCES_PREFIX)) {
              try {
                sources = JSON.parse(head.slice(SOURCES_PREFIX.length)) as SourceRef[];
              } catch {
                sources = [];
              }
            }
          }

          if (buffer) {
            text += buffer;
            buffer = "";
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: text, sources } : message,
              ),
            );
          }
        }

        const finalMessage: ChatMessage = {
          ...assistantMessage,
          content: text.trim(),
          sources,
          streaming: false,
        };
        setMessages((current) =>
          current.map((message) => (message.id === assistantId ? finalMessage : message)),
        );
        if (finalMessage.content) await persist(finalMessage);
      } catch (caught) {
        const aborted = caught instanceof DOMException && caught.name === "AbortError";
        setMessages((current) => {
          const target = current.find((m) => m.id === assistantId);
          if (aborted && target && target.content.trim()) {
            const kept = { ...target, streaming: false };
            void persist(kept);
            return current.map((m) => (m.id === assistantId ? kept : m));
          }
          return current.filter((m) => m.id !== assistantId);
        });
        if (!aborted) {
          const code = caught instanceof Error ? caught.message : "err.generic";
          setError(code.startsWith("err.") ? code : "err.network");
        }
      } finally {
        abortRef.current = null;
        setStatus("idle");
      }
    },
    [persist],
  );

  const send = useCallback(
    async ({ text, attachments, mode }: SendOptions) => {
      if (!userId) return;
      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
        attachments,
        sources: [],
        mode,
        createdAt: new Date().toISOString(),
      };
      const history = [...messages.filter((m) => !m.streaming), userMessage];
      setMessages(history);
      void persist(userMessage);
      await runCompletion(history, mode);
    },
    [messages, persist, runCompletion, userId],
  );

  const regenerate = useCallback(
    async (assistantId: string, mode: ModeId) => {
      const index = messages.findIndex((m) => m.id === assistantId);
      if (index < 0) return;
      const history = messages.slice(0, index);
      setMessages(history);
      await supabase.from("messages").delete().eq("id", assistantId);
      await runCompletion(history, mode);
    },
    [messages, runCompletion],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(async () => {
    if (!userId) return;
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setNotice(null);
    const { error: dbError } = await supabase.from("messages").delete().eq("user_id", userId);
    if (dbError) console.error("clear conversation", dbError.message);
  }, [userId]);

  const generateImage = useCallback(
    async (prompt: string, aspect: "1:1" | "3:2" | "2:3") => {
      if (!userId) return;
      setError(null);
      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: prompt,
        attachments: [],
        sources: [],
        mode: "vision",
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current.filter((m) => !m.streaming), userMessage]);
      void persist(userMessage);
      setStatus("generating");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("err.auth");
        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prompt, aspect }),
        });
        const json = (await response.json()) as { image?: string; error?: string };
        if (!response.ok || !json.image) throw new Error(json.error ?? "err.imageFailed");

        const imageMessage: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: "",
          attachments: [],
          sources: [],
          imageUrl: json.image,
          mode: "vision",
          createdAt: new Date().toISOString(),
        };
        setMessages((current) => [...current, imageMessage]);
        await persist(imageMessage);
        return imageMessage;
      } catch (caught) {
        const code = caught instanceof Error ? caught.message : "err.imageFailed";
        setError(code.startsWith("err.") ? code : "err.imageFailed");
        return undefined;
      } finally {
        setStatus("idle");
      }
    },
    [persist, userId],
  );

  return {
    messages,
    loading,
    status,
    error,
    notice,
    setError,
    setNotice,
    send,
    stop,
    clear,
    regenerate,
    generateImage,
  };
}
