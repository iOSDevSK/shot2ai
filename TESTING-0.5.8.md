# Shot2AI 0.5.8 verification

## Background attachment regression

The previous Gemini fixture rendered image previews immediately. It only suspended answer rendering, so it missed uploads whose previews also depend on animation frames. The fixture now schedules the preview through requestAnimationFrame in its background-rendering mode.

A new Playwright regression delays the page's 100 ms frame-fallback timer to 60 seconds while suspending native frames. Before the fix the actual card flow failed to reach an answer within 30 seconds. After the fix it sends twice to the same conversation, receives both answers, verifies exactly one upload and one image per message, keeps the source tab active, and releases the helper after each answer. A second regression covers successful sends without an answer watcher, including helper cleanup.

The fix pulses the frame queue from the extension while pasteInPage is running. Previously these external pulses started only in the answer watcher, after submission. Background-enabled automatic sends now receive this assistance even when no answer watcher will follow. All pulses stop when the send ends; only an answer watcher retains the frame lease.

## Live Playwright procedure

`node tests/live-gemini.mjs` runs against real signed-in Gemini with no page or network mocks. Login is manual. The harness opens the extension popup, clicks Capture area, drags the source-page region, fills the card message, clicks Send to Gemini and checks the returned answer in that same card. A second send reuses the conversation after six minutes on another tab.

The test browser retains Chromium background throttling: Playwright's usual flags disabling it are removed. Its extension copy grants all-site capture permission because opening a popup in a tab does not confer activeTab, and opens the card's shadow root for locators. These instrumentation changes are absent from the release. The real service worker, upload code, answer watcher and card message flow run unchanged.

Setup attempts exposed harness issues before the live check: exact button matching included a shortcut label; capture needed the test-only activeTab substitute; a separate browser profile was not signed in. The completed run must use the Playwright profile in which the user signed in. These failed setup attempts are not counted as passing service tests.

The live trace starts only after login. Reports and screenshots remain local, outside the release ZIP. This checks Gemini only; the normal suite uses stand-ins for the other chat services.

## Automated results

- Full Playwright suite: **89 passed (7.5 minutes)**, including the two new background attachment regressions.
- Before the fix, the new stalled-timer card-flow regression failed (32 seconds). The focused background-rendering suite passed all 9 tests after the fix.
- All 30 production JavaScript files pass `node --check`; `git diff --check` passes.
- Package validation: 47 files, 96 references; no live harness or trace is shipped.
- Compared with 0.5.7, packaged changes are restricted to the version, `src/webchat.js`, the explanatory header in `src/background-frames.js`, and README.

## Live results

- Fresh conversation: the real card flow returned `Gemini answered` with `SHOT2AI LIVE CHECK`; Gemini was never activated during the send/answer check.
- The initial idle/reuse run was interrupted when its browser tabs were closed. Its first send remains a passing result, but that run is not recorded as a complete pass.
- Repeated the reuse case against that same test conversation. After **360 seconds** in the background, a newly captured image was sent through the popup/card flow and the answer again appeared in the source card. Result: **passed**, `geminiActivated: false`.
- Fresh-send evidence: `/tmp/shot2ai-live-playwright-058c/source-1.png` and `result.json` in that directory.
- Reuse evidence: `/tmp/shot2ai-live-playwright-058-reuse/result.json`, `source-2.png` and `trace.zip`.
- The final two background-upload regressions were rerun after strengthening their activation checks: **2 passed (14.5 seconds)**.
- Read-only audit after the background tests: the real Gemini conversation contains exactly two user messages, each with exactly one image. Audit saved as `attachment-audit.json` alongside the reuse report. This foreground audit occurred only after both background answer checks finished.
- `~/Downloads/test/shot2ai` still links to the repository; `shot2ai-0.5.8.zip` was copied there and verified byte-for-byte.
