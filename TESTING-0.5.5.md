# Shot2AI 0.5.5 verification

## X.com keyboard conflict

X's currently served keyboard module uses Mousetrap listeners for keydown, keypress and keyup. The extension's closed shadow root retargets events to its host DIV, hiding the message input from the site's editable-field check. Previously only keydown was contained; keypress and keyup could trigger X shortcuts.

The card and toolbar now contain all three keyboard events without cancelling native text-editing defaults. Area selection takes focus and restores the previous element afterward, preventing typing from reaching the underlying page while selecting a screenshot. Composition Enter/Escape are ignored by the card's submit and dismiss handlers.

## Verification

- Live X.com, separate temporary test tabs: a synthetic `?` keypress dispatched from the closed-shadow message input with the released 0.5.4 card code was prevented by X and opened `/i/keyboard_shortcuts`. With the final card code, the event was not prevented, X stayed at `/home`, and no dialog opened. Test runtime messages were stubbed; nothing was posted or sent. Test tabs were closed afterward.
- Six browser tests use the actual closed shadow root and trusted Playwright keyboard input: typing shortcut letters, page shortcuts outside the card, select all, caret movement, backspace, undo, copy/paste, composition handling, Enter submission, arrow navigation, Escape dismissal, and protecting the page's existing draft during area selection.
- These keyboard tests leave the shadow root closed, unlike the general smoke suite, so they reproduce the event retargeting involved in the bug.

## Claude attachment detection

The live Claude composer nests its editable textbox inside nine wrappers. Its send button is nearer than its attachment thumbnails; the previous generic scope therefore missed the image. The adapter now scopes attachment detection to the whole composer fieldset and counts stable `file-thumbnail` elements rather than temporary uploading descendants.

- Live claude.ai: the generated PNG was accepted, the thumbnail count grew from one to two, the test text was inserted, and the send button was clicked exactly once. A test-only click guard prevented submission because Claude restored the owner's existing screenshot draft even in a new/incognito composer. The helper removed its own test image and text afterward. This verifies live upload and send readiness, not a live Claude answer.
- Browser regression: a deeply nested composer with separate previews completes an upload, submits once, and returns its streamed answer. A failed upload sends nothing. Upload progress markup disappears without falsely reporting a failed upload.
- Claude Code integration is separate from claude.ai and was not tested here.

## Perplexity attachment handling

The live file input lists filename extensions (including `.png` and `.jpeg`) instead of `image/*`. The shared uploader now matches the actual filenames and MIME types against all accepted formats, including comma-separated lists and case-insensitive extensions.

- Browser regression: an extension-only accept list uses the file input once, never the paste/drop fallbacks, then submits and returns an answer while the source page stays active.
- Live perplexity.ai: the correct file input still triggered Perplexity's own **“Upgrade for additional document analysis”** dialog. Successful live upload/answer could not be verified on this account. No message was submitted.
- Following that check, explicit plan/sign-in refusals now stop the upload flow immediately instead of retrying paste and drop. The card uses the first line containing the limit/upgrade reason, leaving out the pricing advertisement. Regression checks verify one refusal dialog, a concise reason, and no submitted message.

## Final checks

The complete 76-test browser suite covers these regressions plus the existing model/effort selection, default prompts, background answers, captures and editor flows. **Result: 76 passed (7.0 minutes).** All 30 production JavaScript files passed `node --check`, and `git diff --check` passed. Packaging verified 47 files and 96 references; every packaged source matched the working tree and no temporary live-test helpers were included. Test screenshots are written under `/tmp/shot2ai-0.5.5-final`, leaving the repository's existing screenshots untouched.
