# Roadmap

- [done] Replace the hard-coded chat model with a server-side OpenAI-compatible provider configuration.
- [done] Detect incomplete response streams; never treat an abrupt end as a completed answer.
- [done] Keep partial text when a stream fails and show the actual failure state.
- [done] Route XOVA Coder through the same configurable provider instead of a hard-coded model provider.
- [blocked] Add a valid AI provider API key and model to the production server environment, then run an authenticated end-to-end chat and Coder test.
- [done] Keep Tavily search separate from the model provider and cite only retrieved source URLs.
