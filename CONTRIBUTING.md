# Contributing to EchoLedger

EchoLedger is an evidence-first research tool. Contributions are welcome, but changes that make it easier to invent evidence, erase uncertainty, or present AI output as historical truth will not be accepted.

## Before you start

- Read the [README](README.md) and [architecture notes](docs/architecture.md).
- Check existing issues and pull requests.
- For a large change, open an issue describing the research workflow it improves before writing code.
- Do not include real oral-history recordings, personal data, or API keys in issues, pull requests, screenshots, or commits.

## Local setup

```bash
git clone https://github.com/rohanhalaj18/EchoLedger.git
cd EchoLedger
npm install
cp .env.example .env
```

Add `GEMINI_API_KEY` to `.env` only if you need to exercise live AI paths. Never commit `.env`.

```bash
npm run dev        # API :8787 + Vite :5173
npm run typecheck
npm run build
```

## Evidence-integrity rules

These are product requirements, not style preferences.

1. **Never fabricate or paraphrase a quotation.** A stored quote must be sliced from the canonical transcript. If matching fails, reject the claim.
2. **Never invent timestamps.** A playback position may be stored only when it comes from a verified segment or Gemini word offset.
3. **Never convert relative time into a calendar date.** Preserve expressions such as "the year after the flood" and "about seventy years ago".
4. **Never declare narrator truth.** Comparison labels describe relationships between accounts. They do not establish historical fact or decide who is right.
5. **Keep uncertainty visible.** Distinguish explicit from inferred claims, and describe evidence quality rather than truth.
6. **Preserve the original language.** Do not overwrite a narrator's wording with a translation. Translations belong in the separate `translation` field.
7. **Consent before external processing.** Every new Gemini call path must show what leaves the device and require explicit confirmation.
8. **Label demo data.** Fictional data must remain marked DEMO in the UI and in every export.
9. **Do not add analytics, trackers, or silent network calls.** The local-first promise is part of the product.

## Code style

- TypeScript strict mode is enabled in both workspaces.
- Keep shared types in `client/src/types.ts` or `server/src/schemas.ts`.
- Validate all external input with Zod on the server.
- Keep model prompts in `server/src/prompts.ts`; keep provider calls in `server/src/gemini.ts`.
- Use the existing design tokens and components in `client/src/styles/global.css` and `client/src/components/`.
- Prefer small, focused functions and explicit error messages over silent fallbacks.
- Do not expose provider error text directly to the browser. Map failures to stable API errors in `server/src/errors.ts`.

## Checks

This MVP intentionally has no automated test suite. Before opening a pull request:

```bash
npm run typecheck
npm run build
```

Then walk through the affected flow in a browser. At minimum, verify:

- The dashboard and demo archive still load.
- A transcript-only recording can be saved, opened, edited, exported, and deleted.
- Claims still show a verbatim quotation and the correct timestamp provenance.
- Comparisons still validate claim references and render their disclaimers.
- Mobile navigation and dialogs remain usable.
- No secret or `.env` file is staged.

If you add a new AI path, test both the no-key response and the keyed response. Include the exact model IDs and a short description of the result in the pull request. Never paste an API key or a real recording into the pull request.

## Commits and pull requests

- Use focused commits with an imperative subject, for example:
  - `feat: add transcript-only recording intake`
  - `fix: reject unsupported claim dates`
  - `docs: document the evidence model`
- Describe the user-visible change and the evidence-integrity impact.
- Include screenshots for visual changes, using fictional demo data only.
- Call out any migration, storage-schema, or model-behaviour changes.

## Security

Report security issues privately to the repository owner rather than opening a public issue. Do not include exploit details, keys, or personal recordings in a public report.

## License

By contributing, you agree that your contribution is licensed under the repository's MIT license.
