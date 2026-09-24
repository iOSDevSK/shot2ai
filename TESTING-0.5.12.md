# Shot2AI 0.5.12 — selected text

Select page text or a range in a text field, then use Alt+Shift+T (Option+Shift+T on Mac), the selection context menu, or the popup's Send selected text. The existing card previews text, offers saved/custom prompts and sends prompt + selected text without a bitmap or attachment. Empty prompts resolve to the first saved prompt. Answers, follow-up chat and stack restoration work as before. Copy and UTF-8 TXT saving are supported. Password fields are excluded; selections above 100,000 characters are refused without sending.

Chrome supports four suggested shortcuts. The new text command takes the former saved-region default slot; saved-region capture remains in the menus and can be assigned a shortcut in Chrome. Chromium reported the text binding as ⌥⇧T.

The current html2wp Mac bridge was checked in local source: it validates at least one PNG. Text-only requests therefore return an actionable local explanation instead of making an invalid request. A mixed stack with an actual screenshot can still include selected text in its message.

## Checks

Across the regression runs, **109 distinct Playwright tests passed**, with **6 Gemini send tests intentionally skipped** because Gemini remains hidden. This includes 12 text-specific checks. The initial full run exposed the expected context-menu list change; the first smoke continuation exposed a changed screenshot failure message, which was restored while retaining separate text-only wording. All affected and remaining tests passed after those fixes.

- 51 non-smoke checks passed in `/tmp/shot2ai-0512-full-tests.log`; the additional Mac bridge text guard passed later.
- The first 25 smoke tests passed in `/tmp/shot2ai-0512-smoke-tests.log`.
- The remaining tests plus selection checks ran against the final unpacked release ZIP: **36 passed, 6 skipped**, `/tmp/shot2ai-0512-remaining-tests.log`.
- Earlier isolated text checks: **11 passed**. Packaged text checks including the bridge guard: **12 passed**, `/tmp/shot2ai-0512-package-tests.log`.
- Syntax checked for all 31 shipped JavaScript files; `git diff --check` clean.
- `python3 scripts/package.py`: 48 files, 97 references, matching versions in all package roots. ZIP contents compared byte-for-byte with source; temporary browser reload helpers excluded.

The tests run in real Chromium with the unpacked extension and local provider fixtures. They verify selections, Unicode and line breaks, editable inputs and same-origin frames, safe preview rendering, Enter to send, default/custom/saved prompts, zero image uploads, answers, follow-ups, reload persistence, drafts, copying, TXT contents, multi-destination and mixed-stack sends. Screenshot creation is explicitly made to fail during text capture to prove the text path never requests it.

The suite invokes the registered command handler and checks Chrome's actual command binding, rather than synthesizing an OS-wide extension shortcut. Closed shadow roots are opened only in the test copy. This is not a claim of live ChatGPT, Claude or Perplexity end-to-end testing.

Local delivery: `~/Downloads/test/shot2ai-0.5.12.zip`; the unpacked symlink points to this project. The installed Brave extension was reloaded after checking for active answers and preserving open drafts. Its popup reported **Shot2AI v0.5.12**, with the **Send selected text** button and **⌥⇧T** binding, and Gemini absent. Only the diagnostic extension tab was opened and closed; no live provider message was sent.
