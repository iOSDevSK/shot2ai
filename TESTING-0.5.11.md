# Shot2AI 0.5.11

Brave's installed extension popup reported **Shot2AI v0.5.9** while the unpacked source was already 0.5.10. The older worker supplied no chat icon and had no `card-followup` handler. Reproduced both reported symptoms: the literal `undefined` in the button and an unconfirmed follow-up when the handler returned no response.

Changes:
- A local SVG fallback covers older icon payloads. Restored cards refresh their icon map instead of keeping the first payload forever.
- Missing worker replies and synchronously invalidated extension contexts preserve the draft and answer and explain how to reload. No automatic retry sends a duplicate message.
- A saved answer without a conversation URL is migrated only if its original provider tab still shows the same question and identical parsed answer. Changed content is refused before sending.

Playwright checks use Chromium with local provider fixtures. They cover both icon regressions, missing/invalid worker contexts, keyboard containment, repeated follow-ups for all three enabled providers, draft/history restoration, navigation during sending, and old-answer migration with mismatch refusal. They do not claim live provider end-to-end verification.

Command:

```sh
SHOT2AI_SHOTS=/tmp/shot2ai-0511 npx playwright test tests/card-icons.spec.mjs tests/keyboard.spec.mjs tests/smoke.spec.mjs -g 'chat icon:|follow-up:|keyboard:|In-card chat:|legacy answer:' --reporter=line
```

Both icon regression tests failed on 0.5.10 before the fix. Log for the fixed run: `/tmp/shot2ai-0511-tests.log`.

Final targeted run: **17 passed (1.1 minutes)**. Both reported icon failures were reproduced before the fix. The draft-preservation check before reloading Brave found no saved answer card currently open to preserve.

After reloading the installed Brave extension, its popup reported **Shot2AI v0.5.11**, and its destination selector contained no Gemini option. The temporary reload helper was removed before packaging; the ZIP was verified byte-for-byte against the source files, with the Downloads unpacked symlink still pointing to this project.
