import { describe, expect, it } from "bun:test";
import { GEMINI_MODEL } from "./gemini.server.ts";
import { buildSystemPrompt } from "./xova-prompt.server.ts";

describe("Gemini chat model", () => {
  it("uses gemini-2.5-flash for direct chat requests", () => {
    expect(GEMINI_MODEL).toBe("gemini-2.5-flash");
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
});