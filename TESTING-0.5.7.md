# Shot2AI 0.5.7 verification

## Gemini model and thinking menu

Live Gemini uses `gem-menu-item` elements with `aria-haspopup="false"`. The old picker treated the presence of that attribute as a submenu and omitted all model names. The corrected picker checks its value. Gemini model rows have `data-mode-id`; thinking rows do not. The adapter reads model names from `.label`, selected state from `.selected`, and presents Standard/High thinking separately from models.

Gemini can replace the mode button after changing thinking level and leave the menu open. The picker recognizes the replacement button and the already-open Gemini menu, then closes it through the current trigger. It reopens the menu to confirm the selected thinking level.

Outdated typical Gemini names are no longer offered. An existing explicit choice such as Fast is not silently mapped to a different model: choose the current live name or Chat's current model.

Live results:
- Read `3.5 Flash-Lite` as the sole current model, with the same selected model.
- Switched to High thinking and independently confirmed it.
- Restored Standard thinking and independently confirmed it; the menu was closed afterward.

## Answers in a background tab

The original screenshot's completed answer was readable when the Gemini tab was active. During a separate live test, incoming paragraphs existed in the DOM but remained `pending` and hidden while the tab was inactive. The browser's paused animation frames also delayed screenshot attachment previews.

Gemini now uses the existing temporary background animation-frame helper during sending and answer watching. Gemini's markdown `aria-busy` is not a generation signal: it can remain true for a suspended visual animation after the stop button disappears and the answer is available.

Live results:
- Generated test PNG was attached and submitted successfully with background frames enabled.
- The production answer watcher returned state `done` and text `GEMINI_FIXED_OK`, with `geminiActive: false`.
- Temporary storage, captures and owned Gemini test tabs were cleaned up. The user's original Gemini conversation was left open.

## Automated checks

- New picker regressions cover false haspopup attributes, simultaneous model/thinking selection, replacement mode buttons, stale Fast choices, and ignored thinking changes.
- End-to-end regression reads the popup's Flash-Lite and thinking options, sends one image with High thinking, receives the streamed answer while native background frames are suspended, accepts completion despite animation-only aria-busy, and verifies helper cleanup.
- All 30 production JavaScript files pass syntax checks. Test screenshots use `/tmp/shot2ai-0.5.7-final`.
- Full suite: **87 passed (7.2 minutes)**. After the final live-discovered replacement-button refinement, the 32 picker regressions and the 4 Gemini picker/end-to-end checks passed again.
- Packaging: 47 files, 96 references verified; all packaged sources match the working tree, with no temporary live helpers.
