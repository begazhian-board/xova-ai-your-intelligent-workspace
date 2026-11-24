<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture decisions
- Chat and XOVA Coder use a server-held OpenAI-compatible Chat Completions endpoint configured through AI_API_KEY, AI_API_BASE_URL, AI_MODEL, and AI_CODER_MODEL. Tavily remains a separate server-side search provider.
