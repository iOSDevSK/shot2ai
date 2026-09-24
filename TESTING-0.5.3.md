# Shot2AI 0.5.3 verification

## Automated results

- Full suite: `SHOT2AI_SHOTS=/tmp/shot2ai-0.5.3-final npm test` — **67 passed** in 6.6 minutes.
- After preserving the native callback `this` binding in the final review, reran all frame-helper and background-answer integration cases — **7 passed** in 22.2 seconds.
- All 30 shipped JavaScript files passed `node --check`; `git diff --check` passed.
- Final ZIP: 47 files, 96 references checked, ZIP integrity and version 0.5.3 verified. The packaged frame helper matches the final source; no temporary live-test modules are included.
- `~/Downloads/test/shot2ai` resolves to the source checkout; `~/Downloads/test/shot2ai-0.5.3.zip` contains the release.

## Background answers

The bug was reproduced on live ChatGPT in Brave: a submitted message had no rendered response until the tab was activated. A temporary animation-frame fallback installed before submission allowed the answer to render without activating the tab. Changing the page's reported visibility alone did not fix it; the shipped fix does not change visibility or focus.

The regression fixture suspends native animation frames and renders streamed answer chunks through that scheduler. The released 0.5.2 ZIP fails this test by remaining at “ChatGPT is answering…”. The new implementation delivers the answer to the preview card with the source tab still active and restores the scheduler afterward.

Additional checks cover cancellation, native-frame/timer races, concurrent watches, abandoned watcher expiry, sends that fail, closed answer cards and answer timeouts.

## Live verification of the release code

On 2026-09-24, the loaded 0.5.3 extension submitted a generated PNG and a short test prompt separately with GPT-5.5 / Instant and GPT-5.6 Sol / Instant. Its actual `pasteIntoChat` and `watchAnswer` functions delivered the expected text into the stored capture answer with state `done` for both models. The source tab remained active throughout both watches; neither ChatGPT tab was activated. The temporary frame helper was absent after completion in both tabs. GPT-5.6 Sol / Pro was restored afterward, and test captures, settings and tabs were removed.

The automated integration test separately verifies that the delivered answer appears in the preview card, including formatted code, while the source tab remains active.

## Deferred Claude test

This release addresses the newly reported ChatGPT background-answer bug. The live Claude / Claude Code test remains deferred until the user resumes it after the account limit clears; its next planned release is 0.5.4. Clarify the intended Claude Code integration before testing it. No live Claude requests were made for this fix.
