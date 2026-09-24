# Shot2AI 0.5.4 verification

`SHOT2AI_SHOTS=/tmp/shot2ai-0.5.4-final npm test`: **68 passed** in 6.6 minutes.

The first saved prompt is now the default. Its row has a visible Default badge; moving or deleting rows updates that designation. The previous independent default selection is no longer used.

Focused integration checks cover:

- Reordering prompts, deleting the first prompt, and displaying exactly one Default badge.
- Prefilling a new capture and the editor from the first prompt, including when an old saved default ID points elsewhere.
- Sending a whitespace-only message to mock ChatGPT after the prompt order changes; the current first prompt is sent and shown in the answer card.
- Empty-message fallbacks in batch sends, multi-destination sends and the screenshot editor against the local mock html2wp bridge.
- Preserving explicit text, taking edits into account at send time, and returning an empty message when all prompts have been deleted.

The Options screenshot was visually inspected. All 30 JavaScript files passed syntax checks. Release packaging checked 47 files and 96 references; ZIP integrity, version consistency and the unpacked symlink were verified.

No live AI requests were needed for this prompt-selection change. Live Claude / Claude Code testing remains deferred until resumed by the user.
