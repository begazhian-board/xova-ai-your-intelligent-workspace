# Roadmap

- [done] Fix chat reliability: Gemini free quota exhausted → per-model fallback chain (gemini-3.8-flash → 3.7-flash → 3.1-flash-lite → Lovable gateway). Verified: chat replies again.
- [done] Watermark on generated images: "XOVA AI" badge on studio + chat display, baked into downloaded PNG via canvas.
- [done] Fresh chat answers: automatically search live sources for current/time-sensitive questions using the configured web-search service.
- [done] Image provider cleanup: removed Pollinations; image creation uses the existing Lovable, Hugging Face (when configured), and Gemini providers, with a clear failure instead of unrelated output.
- [ ] Pending from notes file (not started): landing page, text logo, settings page for user's own AI keys
