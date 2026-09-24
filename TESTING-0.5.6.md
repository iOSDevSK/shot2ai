# Shot2AI 0.5.6 verification

## Default prompt on click

New captures record whether their message was filled automatically. Clicking that prefill clears it once. Input edits and explicitly selected saved prompts clear that marker; they remain intact on later clicks and after navigation. A blank send still resolves the current first saved prompt. Older captures without this marker are preserved rather than guessing whether their text was typed by the owner.

The focused prompt and keyboard run passed 10 tests in 27.7 seconds, including click-to-clear, native typing, a custom message identical to the default, reload persistence, explicit prompt selection, and default fallback at send time. Its first invocation lacked the serial smoke suite's bridge-pairing prerequisite; the corrected invocation included it and passed.

## Claude models and effort

Live DOM inspection showed one primary model followed by **Effort** and **More models** submenus. The original reader ignored submenus; the chooser opened the first submenu regardless of its label. Reading and choosing now collect the complete named model submenu, and fail instead of caching a partial list if that submenu cannot be opened. Send results retain the complete list rather than shrinking the cache to the primary model.

Claude effort uses named menu options, separate from ChatGPT's relative slider positions. It is selected after the model and verified by reopening the effort menu. Missing and ignored choices prevent image attachment and submission.

Live inspection confirmed the current menu roles, linked submenu IDs, model names and effort options. The original Claude tab and a temporary test tab were no longer available before the updated live picker could be executed; no live model-switch or effort-switch success is claimed for this release. No live chat message was sent.

The focused picker run passed 29 tests, including complete Claude lists, submenu selection, all five effort levels, ignored changes, unavailable effort levels, and failed submenu opening, plus existing ChatGPT picker/effort regressions.

## Final verification

**83 tests passed in 7.2 minutes.** All 30 production JavaScript files passed syntax checks; `git diff --check` passed. The release contains 47 files with 96 references verified. Test screenshots are written to `/tmp/shot2ai-0.5.6-final` and do not overwrite the repository's existing screenshots.

## Follow-up: Gemini unreadable answer

The owner reported “Gemini answered in its tab” / “Shot2AI could not read the answer” during final verification. No Gemini tab was available in either Brave or Chrome, and Brave subsequently had no window. The owner was asked to keep the affected Gemini conversation open for DOM inspection. This release does not claim to fix that newly reported issue.
