# Shot2AI 0.5.17 — ChatGPT model picker readiness

## Change

- Treat menus with `data-state="closed"` as inactive even if they still have
  visible geometry. Live ChatGPT retained its Radix menu with an exit animation
  in a background tab after closing it. It must be reopened before use, and
  closing it must not reopen it merely because the exit animation is stalled.

- Recognize the full GPT-5.6 Sol name, including an effort suffix, in a scoped
  composer model button. Matching remains strict; unrelated conversation and
  sidebar controls and ambiguous composer buttons are not used.
- Wait up to six seconds for ChatGPT's model/effort control after the message
  box appears. The message box can mount first during navigation or hydration.
- Wait for Select model inside the intelligence popover before reporting the
  picker missing. Close a newly opened popover if preparation fails.
- Replace an older injected picker implementation when this revision is loaded
  into an already open tab. Repeated injection of this revision remains a no-op.
- Keep the requested model and effort mandatory: failure does not silently send
  with different settings or attach the screenshot first.

## Verification

- Full pre-release Playwright suite: **163 passed, 6 intentionally skipped**
  (hidden Gemini send scenarios), 9.6 minutes. Run against the packaged extension;
  subsequent package updates only normalized whitespace and clarified website
  deployment documentation. Log: `/tmp/shot2ai-0517-full-tests.log`.

- Four regressions failed before the fix: full GPT-5.6 Sol button label, that
  label with High, delayed composer control and delayed Select model mounting.
  All four passed after the fix. A fifth regression for a closed menu retained by an exit animation also failed before the fix and passed afterward. Logs:
  `/tmp/shot2ai-0517-before.log`, `/tmp/shot2ai-0517-after.log`,
  `/tmp/shot2ai-0517-animation-before.log`, `/tmp/shot2ai-0517-animation-after.log`.
- 38 Playwright picker/intelligence/effort/Claude/Gemini regression tests passed,
  including replacement of an older injected implementation. Hidden Gemini
  adapter coverage does not enable Gemini in the product.
  Log: `/tmp/shot2ai-0517-picker-tests.log`.
- Three extension integration tests passed: screenshot sends with GPT-5.5 and
  GPT-5.6 Sol plus effort, delayed-control send, refusal of ignored effort/model
  changes, and the explicit Send with current model fallback.
  These use real Chromium extension execution and local AI fixtures, not paid
  live AI responses. Log: `/tmp/shot2ai-0517-send-tests.log`.
- The same three integration tests were rerun against the unpacked release ZIP.
  Log: `/tmp/shot2ai-0517-packaged-tests.log`.
- In the existing signed-in Brave ChatGPT tab, the updated picker read the actual
  menu, successfully chose GPT-5.6 Sol and restored the previous Latest selection.
  No message or screenshot was sent during this live check. The exact transient
  state shown in the user's screenshot did not recur during live inspection;
  reproducible failures above were verified with controlled Playwright fixtures.
- Syntax checks, git diff whitespace check, all four version fields, ZIP CRC and
  125 packaged references checked. No temporary diagnostics/server files bundled.

## Release

- Version: 0.5.17.
- ZIP: `~/Downloads/test/shot2ai-0.5.17.zip`.
- Unpacked: `~/Downloads/test/shot2ai` (existing repository symlink).
- Reload Shot2AI in `chrome://extensions` before retrying the capture.
- No sharing-server deployment or quota/auth changes in this release.
