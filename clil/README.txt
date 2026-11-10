CLIL Studio browser-direct trial
================================
Open ./index.html through an HTTP(S) static web server. No Python API server is used.
The UI, profile validation, routing, prompts and exports run in the browser. Model
requests go directly to Anthropic, OpenAI or Google using the visitor's own API key.
Keys stay in page memory; they are not included in exports or persistent storage.
Only the UI-language preference uses localStorage. No automatic Render fallback.

This is an experimental alternative to https://clil-studio.onrender.com/.
Account/browser restrictions may block direct requests. Connection failures are shown
without exposing the provider response or key. Anthropic's direct-browser header is
included explicitly. OpenAI requests use store=false; provider-side data policies apply.
Each responding student uses a separate API request and may incur provider charges.

Controls are simulation targets, not validated measures of child behavior. Browser
routing implements focused-v2; engineering sampling defaults are not empirical estimates.
Exports mark execution_mode=browser-direct and app_version=0.7.1-browser.1.
The unchanged Render version uses its existing backend and version metadata.

Build source: CLIL-studio/simulator/build_browser.py and simulator/browser/runtime.js.
API references checked 2026-11-10:
https://platform.claude.com/docs/en/manage-claude/authentication
https://developers.openai.com/api/docs/guides/text
https://ai.google.dev/gemini-api/docs/api-key
