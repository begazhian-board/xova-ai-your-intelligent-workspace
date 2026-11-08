import { describe, expect, it } from "bun:test";
import { GEMINI_MODEL } from "./gemini.server.ts";
import { chatProviderErrorCode, searchNoticeCode, shouldTryChatFallback } from "./chat-contract.ts";
import { buildSystemPrompt } from "./xova-prompt.server.ts";

describe("Gemini chat model", () => {
  it("uses Google's recommended Gemini 3.8 Flash model for direct chat requests", () => {
    expect(GEMINI_MODEL).toBe("gemini-3.8-flash");
  });
});

describe("chat fallback and search status", () => {
  it("falls back only before any visible answer has started", () => {
    expect(shouldTryChatFallback(false)).toBe(true);
    expect(shouldTryChatFallback(true)).toBe(false);
  });

  it("maps Gateway credit exhaustion to a clear actionable error", () => {
    expect(chatProviderErrorCode("gateway", 402)).toBe("err.gatewayCredits");
  });

  it("warns reasoning and research users when grounded sources are unavailable", () => {
    expect(searchNoticeCode("reasoning", 0, true)).toBe("err.searchFallbackUnavailable");
    expect(searchNoticeCode("research", 0, false)).toBe("err.searchNoSources");
    expect(searchNoticeCode("research", 2, false)).toBeNull();
    expect(searchNoticeCode("instant", 0, true)).toBeNull();
  });
});

describe("buildSystemPrompt current date", () => {
  it("provides the authoritative current UTC date to the assistant", () => {
    const prompt = buildSystemPrompt(
      {
        mode: "instant",
        personality: "friendly",
        responseStyle: "balanced",
        language: "ar",
        searchAvailable: true,
      },
      new Date("2026-11-06T08:54:00.000Z"),
    );

    expect(prompt).toContain("The current date is 2026-11-06 (UTC)");
    expect(prompt).toContain("never claim the year is 2024");
  });

  it("instructs the assistant to use grounded search for current and political facts", () => {
    for (const mode of ["reasoning", "research"]) {
      const prompt = buildSystemPrompt({
        mode,
        personality: "friendly",
        responseStyle: "balanced",
        language: "ar",
        searchAvailable: true,
      });

      expect(prompt).toContain("Search whenever the question depends on current, recent, or politically changing information");
      expect(prompt).toContain("never invent citations or URLs");
    }
  });
});