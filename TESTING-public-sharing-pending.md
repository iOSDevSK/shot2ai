> Historical report. Deployment and current validation are documented in [TESTING-0.5.15.md](TESTING-0.5.15.md).

# Public conversation sharing — implementation pending deployment

Date: 2026-09-24. Last delivered extension version remains **0.5.14**.
The next release must get a new version; do not overwrite the 0.5.14 ZIP.

The user approved public conversation copies. The missing input is the hosting
destination/domain for the separate service. `src/share-config.js` deliberately
has an empty origin. No public conversations were uploaded and no deployment or
new release was performed in this implementation pass.

## Completed checks

- `npx playwright test tests/share.spec.mjs tests/share-server.spec.mjs tests/card-icons.spec.mjs --timeout 30000`
  — **23 passed**, 7.0 seconds. Log: `/tmp/shot2ai-0515-final-checks.log`.
- Syntax checks for **46** JavaScript files across `src/` and `share-server/`,
  plus the Python configuration script — passed.
- `git diff --check` — passed.

The browser tests run an actual Node HTTP sharing service, upload the sanitized
conversation and original PNG, load its public page in another browser tab, and
compare image bytes. A complete card-click test uses the real extension runtime
and background handler to create a link and open the Facebook sharing route.
Only the final Facebook/X destination is intercepted, to avoid publishing posts.
There is no clipboard stub in the new public sharing path.

Also checked: all exchanges, Unicode, source links, exclusion of drafts/private
chat URLs/arbitrary fields, HTML/script injection, Open Graph metadata, deduped
uploads, persistence across a service restart, expiry, deletion capability,
page/image revocation, input/body/rate/storage limits, network failure without an
empty social tab, PDF pagination, exact embedded PNG in MD, capture schema
compatibility and the older chat-icon payload.

The initial native-launch test exposed navigation starting before the handoff
page completed loading. The automatic protocol launch now runs on the load event;
the corrected test and full targeted suite passed. An initial management test
depended on an earlier test's data; it now creates its own shared copy.

## Still required before release

1. Select and deploy persistent HTTPS hosting; see `share-server/README.md`.
2. Configure the verified origin and its manifest host permission using
   `scripts/configure-sharing.py`.
3. Verify a synthetic public copy from outside the local machine. Test the real
   native WhatsApp recipient chooser and real Facebook/X sharing composers.
   The current tests verify the protocol URL and prefilled link, **not** native
   app receipt, social account acceptance or a posted message.
4. Delete the synthetic link and verify both public resources return 404.
5. Publish the revised privacy information; bump manifest/package/lock versions,
   build with `python3 scripts/package.py`, retest the ZIP and deliver it through
   `~/Downloads/test/shot2ai`.

No full chat-provider regression suite was repeated: this change does not modify
provider adapters, uploads to AI chats, model/effort selection or answer polling.
