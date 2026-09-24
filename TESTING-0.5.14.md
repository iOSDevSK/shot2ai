# Shot2AI 0.5.14 verification

Local release, 24 September 2026. Manifest, package and both lockfile root versions are 0.5.14. The intermediate 0.5.13 was loaded in Brave during verification; the final compatibility changes have their own version.

## Delivered behavior

- Answer-card Share control uses the square/up-arrow icon and replaces the duplicate bottom Close. Top X stays. Menu: WhatsApp, Facebook, X, PDF, MD; keyboard navigation, Escape, focus return, narrow-screen fit, and older icon payload fallback.
- Exports take a snapshot of the full saved history, original PNG or selected text, all questions/answers and sources. Drafts and private chat URLs are omitted. Incomplete captured answers are marked.
- PDF: local preview and system print dialog, Save as PDF. Playwright generated an actual multipage PDF and verified its PDF signature, image object and page count, plus Unicode and last-paragraph content in the rendered document.
- MD: UTF-8 download containing all exchanges, source links and the exact base64 original PNG. Some Markdown viewers do not render data-URL images; PDF is the portable display option.
- Social: full-conversation PNG prepared locally, copy-image button plus selected service, download fallback on clipboard failure. The user pastes/attaches and sends on that service. There is no automatic post or public upload. Overlarge conversations are directed to PDF/MD, never cropped.
- Export snapshots expire after one hour and are pruned on subsequent access. Clear all removes their separate database as well as captures/settings.
- Capture database preserves schema 1 captures while upgrading folder-handle support to schema 2, and reads an existing schema 3 without requesting a downgrade. It does not reset the database. Export storage does not upgrade the capture database.
- Popup removes full-page, selected-text and integration-enable buttons. Shortcuts remain configurable in Settings; capture actions remain in commands/context menus and integrations have their own Settings section.
- Model/effort “Use selected … in chat” labels mean no switching. Existing tests verify that empty choices do not operate the provider's picker. No model-switching behavior was changed for the reported two-ChatGPT-tabs situation.
- Approved website registry: HTTPS URL/path + prompt, deterministic tag, GitHub PR validation and post-merge generation workflow, strict source/target scope checks, first-party real clicks, optional all-site opt-in, cache/offline fallback and permission sharing with the floating toolbar.
- Agentmods component and mod-detail placement prepared in its local repository. Non-installed visitors see the GitHub installation hook; opted-in installations see Explain with Shot2AI. Its tag is s2ai-86b27adc1b21ccfd.

## Automated evidence

- Full Playwright suite for the implementation before final legacy-database hardening: **127 passed, 6 intentionally skipped**, 8.6 minutes. Log: `/tmp/shot2ai-0513-full.log`.
- Final 0.5.14 ZIP unpacked into a fresh directory and loaded into Chromium: **23 checks passed**, `/tmp/shot2ai-0514-package-tests.log`. Includes all share/export/retention/schema checks, registry validation, scope and opt-in checks, Agentmods fallback layout, actual extension button → local ChatGPT fixture → answer → follow-up, shared toolbar permissions, shortcut settings and text-only capture.
- Final ZIP has **58 files**, with **108 runtime/page/module references checked** by `python3 scripts/package.py`; byte comparison against the source and the copy in Downloads passed. No temporary live-debug helper is in the ZIP.
- All **37 JavaScript files** pass `node --check`. `git diff --check` and `python3 scripts/integrations.py --check` pass.
- Agentmods production build passed: `/tmp/agentmods-shot2ai-build-final.log`. Its actual Astro component was also compiled in an isolated static fixture (no database) and tested at 390px and 1440px. The local mod-detail SSR site could not be exercised against its unavailable PostgreSQL instance; no production deployment was performed.

Provider chat pages are local Playwright fixtures. These checks do not claim a new successful send on a live ChatGPT/Claude/Perplexity account. No social posts were published. Gemini stays hidden; its six provider smoke tests are intentionally skipped.

The live Brave popup reported **Shot2AI v0.5.14** and confirmed all three removed popup buttons are absent. It was reloaded only while no capture was sending/answering, after saving card inputs. Existing stored captures remained readable. The unpacked path is `~/Downloads/test/shot2ai`; release ZIP is `~/Downloads/test/shot2ai-0.5.14.zip`.

The GitHub workflow and Agentmods changes are local. Publishing the registry/workflow and deploying Agentmods are still required for public website availability; extension packaging does not perform that deployment.
