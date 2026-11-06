import { describe, expect, it } from "bun:test";
import { buildSystemPrompt } from "./xova-prompt.server";

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