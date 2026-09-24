# Shot2AI 0.5.9 verification

## Changes

Gemini creates its `input[type=file][accept="image/*"]` only after the Upload and tools menu opens. The adapter now opens that menu, uses the matching image input, and closes only the menu it opened. Existing document-only inputs are rejected by the accept matcher. Paste/drop remain fallbacks when a matching input cannot be found.

Gemini's failed upload chip uses `.gem-attachment-loading-error` and `uploader-file-preview-container.has-error`, with neither an img nor role=alert. These states now stop fallback upload attempts and report an upload failure. An existing failed attachment gets a separate instruction to remove it before sending again; it is not silently removed or duplicated.

Send readiness respects an enclosing aria-disabled=true component. A known disabled Send button no longer falls back to unrelated nearby buttons such as Upload or microphone; default button type=submit counts as a generic fallback only when it actually belongs to a form.

## Playwright coverage

The lazy-input regression creates the input only after the upload menu opens, rejects synthetic paste/drop, and verifies exactly one image upload, one message, menu closure, and the returned answer. The error regression reproduces the icon-only failed chip, verifies no text/message or fallback attempts, then retries against that failed draft and verifies the explicit blocked-upload instruction.

The initial regression failed before the complete fix. The final two focused tests passed, including the last failed-draft handling change. Gemini card success assertions now require visibility, so hidden text left over from a previous answer cannot satisfy them.

## Live checks and limits

The original failing PNG was read from the user's capture store: 37,466 bytes, image/png. Its bytes were used unchanged through the extension's image-import/card path, with the explicit `3.5 Flash-Lite` choice and `Translate to Slovak language (SK)` prompt.

- Native file attachment via Playwright succeeded with this PNG.
- The strict live card test's first send succeeded: one image, one new user message, a visible Slovak translation mentioning Blankenberge, and Gemini never activated.
- The next send attached and submitted, but Gemini remained generating without text during the test timeout. The Playwright trace shows an incomplete StreamGenerate response. This is not counted as a passing round trip.
- A subsequent live attempt showed Gemini's own error response. The user independently reported that Gemini Flash did not answer even a manually typed hello, and confirmed that this was not an extension bug. Further live sends were stopped. No answer-reader change was made to work around that service failure.
- A separate check in the user's Brave browser loaded the candidate upload modules and sent the same original file with the current model. Its production answer watcher returned done with a Slovak translation, zero upload errors, one image/message, and Gemini inactive. The already-loaded extension manifest still reported 0.5.8 during that module-level probe; this was not a fresh installed-release UI test. An earlier explicit-model probe could not find the picker in its fresh background tab and sent nothing.
- Temporary inspection/test modules were removed from src. Original user captures and the existing failed Gemini draft were left alone.

Evidence: `/tmp/shot2ai-live-playwright-059-verified/`, `/tmp/shot2ai-live-playwright-059-final/`, and `/tmp/shot2ai-brave-native-059.json`. The earlier `/tmp/shot2ai-live-playwright-059/` second-run result used a weaker hidden-text assertion and is explicitly not accepted as a successful second send.

## Final checks and release

- Full Playwright regression suite: **91 passed (7.6 minutes)**.
- Final failed-draft instruction/retry refinement: focused lazy-upload and failed-chip tests rerun, **2 passed (8.9 seconds)**.
- All 30 production JavaScript syntax checks and `git diff --check` passed.
- Version 0.5.9 synchronized in manifest, package.json and both root package-lock entries.
- ZIP: 47 files, 96 references verified, every packaged source matches the tree, no temporary helpers included.
- Compared with 0.5.8 the release changes only manifest, settings, Gemini adapter, webchat and README. Answer reader and background-frame helper remain unchanged.
