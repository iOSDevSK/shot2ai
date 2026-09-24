# Shot2AI 0.5.10

## Changes

- The chat icon beside Continue opens a follow-up composer in the answer card. Enter sends; Shift+Enter adds a line. Earlier exchanges stay in the same scrollable area.
- Follow-ups send text only to the original conversation. Existing drafts/attachments, a changed conversation, or another send in progress stop the send without losing the card's history or draft.
- Questions, answers, conversation URL and draft survive source-page reloads. Turn IDs reject stale answer updates; navigation while sending restores the new conversation history.
- The card fits a smaller viewport. Typing and editing stay inside its closed shadow root without triggering X-style page shortcuts.
- Gemini is hidden from popup, Options, card and context menus, and excluded from multi-send. A saved Gemini default uses ChatGPT. The adapter, preferences and offline tests remain in the repository for future reinstatement.

## Automated verification

Run with screenshots outside the repository:

```sh
SHOT2AI_SHOTS=/tmp/shot2ai-release-0510 npm test -- --reporter=line
```

Final result: **92 passed, 6 deliberately skipped**, in 8.6 minutes. Log: `/tmp/shot2ai-release-0510-tests.log`. All skipped cases are Gemini sends; no active-provider tests are skipped.

The suite uses a real Chromium browser with the unpacked extension and local provider stand-ins. It does not establish live compatibility with the current provider websites. Its test copy grants capture permissions, opens the shadow roots and redirects provider URLs to fixtures.

New checks cover two follow-ups each for ChatGPT, Claude and Perplexity, the same conversation URL, one image upload total, both earlier answers retained, multiline input, draft/history restoration, viewport bounds, changed-conversation and unsent-draft guards, source navigation during sending, keyboard containment and Gemini's absence from all destination menus.

The six Gemini send tests are deliberately skipped while its preset is hidden. The retained standalone Gemini picker tests still run offline. They resume with the preset when it is re-enabled for development.

## Live test limits

A live Playwright attempt against signed-in Gemini during this work reached “Gemini answered in its tab”; the browser was then closed before the test completed. The follow-up was not live-verified. Its trace/report are in `/tmp/shot2ai-live-chat-0510`. No further live Gemini tests were run after the user requested hiding it. No claim is made that a paid Gemini plan resolves its service or integration failures.

## Packaging

`python3 scripts/package.py` validates matching versions in the manifest and npm files and all packaged references. The unpacked release remains linked at `~/Downloads/test/shot2ai`; the versioned ZIP is copied alongside it. Gemini's implementation is retained in the code, but excluded from the visible preset list through `HIDDEN_PRESETS` in `src/settings.js`.

## Reinstating Gemini later

Remove `gemini` from `HIDDEN_PRESETS` in a development copy and publish a new version only after verification. The retained Gemini send scenarios in `tests/smoke.spec.mjs` enable themselves when the preset returns; `tests/gemini-picker.spec.mjs` covers the picker. `tests/live-gemini.mjs` retains the real signed-in browser harness, including optional `SHOT2AI_LIVE_FOLLOWUP=1` for a screenshot and text-only continuation. Recheck upload, model/effort selection, answer readback and repeated sends with the intended account/plan. Do not count a provider error or interrupted browser session as a passing integration test.
