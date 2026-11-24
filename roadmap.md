# Roadmap

- [done] Remove Gemini from chat, XOVA Coder, diagnostics, and runtime dependencies.
- [done] Route chat and XOVA Coder through Cloudflare Workers AI using the account credentials already used by image generation.
- [done] Detect incomplete response streams; never treat an abrupt end as a completed answer.
- [done] Keep partial text when a stream fails and show the actual failure state.
- [done] Keep Tavily search separate from the model provider and cite only retrieved source URLs.
- [blocked] Verify the production Cloudflare token includes Workers AI permission and complete an authenticated end-to-end chat and Coder test.
