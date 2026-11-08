# Roadmap

- [done] Fix chat reliability: Gemini free quota exhausted → per-model fallback chain (gemini-3.8-flash → 3.7-flash → 3.1-flash-lite → Lovable gateway). Verified: chat replies again.
- [done] Watermark on generated images: "XOVA AI" badge on studio + chat display, baked into downloaded PNG via canvas.
- [done] Chat internet access: direct Gemini `gemini-2.5-flash` with Google Search grounding, real returned source links, and no Lovable AI Gateway fallback.
- [ ] Current chat repair: use Google-recommended Gemini 3.8 Flash, add Lovable Gateway fallback for pre-output Gemini failures, preserve verified Google grounding citations, and test reasoning/research plus missing-source notices.
- [done] Image provider cleanup: removed Pollinations; image creation uses the existing Lovable, Hugging Face (when configured), and Gemini providers, with a clear failure instead of unrelated output.
- [ ] Pending from notes file (not started): landing page, text logo, settings page for user's own AI keys
