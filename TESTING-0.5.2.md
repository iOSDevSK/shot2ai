# Shot2AI 0.5.2 verification

Tested locally on 2026-09-24.

## Automated checks

- `SHOT2AI_SHOTS=/tmp/shot2ai-0.5.2-final npm test`: **60 passed** in 6.2 minutes, including model selection, effort controls, captures, image submission, error handling, settings and mock provider integrations. Mock Claude tests make no requests to the live account.
- `node --check` passed for all 29 shipped JavaScript files; `git diff --check` passed.
- `python3 scripts/package.py`: 46 packaged files, 93 references verified, matching package and manifest versions. ZIP integrity checked; temporary live-test harnesses excluded.

## Regression

The released 0.5.1 picker was run against a fixture reproducing the observed ChatGPT DOM. It clicked an inert model radio and returned `modelNotSwitched`, reproducing the reported failure. Version 0.5.2 activates the model view before reading or selecting its radios.

## Live ChatGPT in Brave

- Read the actual model list: Latest, GPT-5.6 Sol, GPT-5.5.
- Switched both GPT-5.5 and GPT-5.6 Sol successfully.
- Verified all five effort positions on each model: Instant, Medium, High, Extra High, Pro.
- Used the loaded extension's `pasteIntoChat` path to attach a generated PNG and submit a test prompt with GPT-5.5 / Instant and GPT-5.6 Sol / Instant. Both returned the expected response token.
- GPT-5.5's response remained unrendered while its tab was in the background and appeared after activating it. Background answer display on the live site is therefore not fully verified. The GPT-5.6 Sol response was checked with its tab active.
- Restored GPT-5.6 Sol / Pro, removed temporary test storage and development harness files, and closed the temporary test tabs.

These live checks exercise model/effort selection and image submission. They do not cover every browser permission prompt, physical keyboard shortcut, or every live provider.

## Next release: 0.5.3

Claude testing is deferred at the user's request because the account limit was reached. The user indicated a reset at 13:20; no live Claude requests are part of this release.

Before the next release:

1. Resolve whether “Claude Code” means the html2wp connection, terminal/editor integration, or Claude on claude.ai. Do not present a claude.ai test as a Claude Code test.
2. Once the limit is available and the user resumes the work, test the intended integration with a generated screenshot and a short prompt.
3. Verify attachment delivery, selected model and supported effort controls, response handling, and a useful error when the service cannot accept a request.
4. Fix any observed issues, run the relevant regression tests, bump the release version, and rebuild the ZIP and unpacked distribution.
