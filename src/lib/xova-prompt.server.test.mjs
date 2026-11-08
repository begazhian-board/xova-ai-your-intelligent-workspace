import { describe, expect, it } from "bun:test";
import { GEMINI_MODEL } from "./gemini.server.ts";
import { chatProviderErrorCode, searchNoticeCode, shouldSearchWeb } from "./chat-contract.ts";
import { buildSystemPrompt } from "./xova-prompt.server.ts";
describe("Gemini chat model",()=>{it("uses direct Gemini",()=>expect(GEMINI_MODEL).toBe("gemini-3.8-flash"));});
describe("Tavily web search routing",()=>{
 it("searches all reasoning and research mode requests",()=>{
  expect(shouldSearchWeb("research","Explain photosynthesis")).toBe(true);
  expect(shouldSearchWeb("reasoning","Compare the political systems")).toBe(true);
 });
 it("recognizes explicit current web searches in English and Arabic",()=>{
  expect(shouldSearchWeb("instant","Find the latest news about NASA")).toBe(true);
  expect(shouldSearchWeb("instant","ابحث على الإنترنت عن آخر أخبار الفضاء")).toBe(true);
 });
 it("does not search ordinary stable questions by default",()=>{
  expect(shouldSearchWeb("instant","What is a metaphor?")).toBe(false);
  expect(shouldSearchWeb("coding","Write a function to sort an array")).toBe(false);
 });
 it("reports missing search sources",()=>{
  expect(searchNoticeCode(true,0,true)).toBe("err.searchOffline");
  expect(searchNoticeCode(true,0,false)).toBe("err.searchNoSources");
  expect(searchNoticeCode(true,3,false)).toBeNull();
  expect(searchNoticeCode(false,0,false)).toBeNull();
 });
 it("maps Gemini provider failures",()=>{
  expect(chatProviderErrorCode(429)).toBe("err.rate");
  expect(chatProviderErrorCode(503)).toBe("err.unavailable");
 });
});
describe("buildSystemPrompt",()=>{
 it("provides the current UTC date",()=>{
  const prompt=buildSystemPrompt({mode:"instant",personality:"friendly",responseStyle:"balanced",language:"ar",searchAvailable:false},new Date("2026-11-06T08:54:00.000Z"));
  expect(prompt).toContain("The current date is 2026-11-06 (UTC)");
  expect(prompt).toContain("never claim the year is 2024");
 });
 it("uses only real Tavily source URLs",()=>{
  const prompt=buildSystemPrompt({mode:"research",personality:"friendly",responseStyle:"balanced",language:"ar",searchAvailable:true});
  expect(prompt).toContain("real Tavily results");
  expect(prompt).toContain("cite only URLs from that block");
  expect(prompt).not.toContain("Google Search");
 });
});
