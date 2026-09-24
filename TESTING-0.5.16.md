# Shot2AI 0.5.16 — sharing verification and card toolbar

## Changes

- A newly issued authorization tolerates up to five minutes of server/client
  clock difference in the client's maximum-expiry check. Token format, embedded
  expiry, trusted origin, top-level frame, owned tab and nonce checks remain.
  Server signature validation and storage/upload quotas are unchanged.
- Pending verification lasts ten minutes. The initial extension operation waits
  at most four minutes; a later successful callback still saves authorization
  for the next Share attempt. An actual expired/missing/mismatched request now
  has its own message rather than every rejection being called expiration.
- Recheck saved authorization when the verification tab disappears between
  polling reads, because a successful callback closes that tab itself.
- Share errors are rendered below the action row, outside the icon's container.
  Buttons stay on one row, icons retain their size, and long labels can truncate
  with their full text available in a tooltip. A retry clears the old error.

## Checks

- Reproduced the old client's rejection of a valid token issued with a clock
  two seconds ahead before the fix: `/tmp/shot2ai-0516-repro.log`.
  This identifies a reproducible defect, not a confirmed diagnosis of the exact
  clock state during the user's screenshot.
- **42 Playwright tests passed**, covering authorization/security, real Chromium
  extension callbacks, card layout, sharing/export/deletion, compression and
  local Cloudflare workerd/R2/SQLite quota enforcement.
  Log: `/tmp/shot2ai-0516-packaged-tests.log`.
- Extension browser tests used the freshly unpacked 0.5.16 ZIP through
  `SHOT2AI_EXT`; unit/card fixture tests use repository modules.
- External-message tests exercise actual Chrome sender validation and storage,
  with only Turnstile/network provider boundaries mocked. They simulate immediate,
  three-minute and five-minute completion, plus a server clock two seconds ahead.
  The five-minute case verifies credential reuse after the initial wait ends.
- Deterministic test covers success arriving between the credential read and
  closed-tab check. Rejection of wrong origin/tab/frame/nonce and replay remains
  covered. Server-side forgery, expiry and key-rotation tests pass.
- Layout checked at 420px and 800px viewport widths after a sharing error; Share
  remains level with Copy, with no toolbar overflow. Screenshot inspected:
  `/tmp/shot2ai-0516-toolbar-420.png`.
- JavaScript syntax, `git diff --check`, Wrangler dry run, synchronized extension
  version fields, ZIP CRC/integrity and all 125 packaged references passed.
  ZIP excludes sharing server, secrets and temporary diagnostics.

## Delivery

- Cloudflare Worker `shot2ai-share` deployed with existing secrets and bindings.
  Version: `c93cd7fd-1c19-4436-81ac-7b737020a1a5`.
- Production GET `/health` and deployed `/connect.js` checked after deployment.
- ZIP: `~/Downloads/test/shot2ai-0.5.16.zip`.
- Unpacked: `~/Downloads/test/shot2ai` (symlink to this repository).
- Reload the extension in `chrome://extensions`, then choose Share again.

The user's screenshot shows that a real human Turnstile challenge succeeded.
The fixed end-to-end human callback has not yet been reverified in their browser;
provider-mocked automation is not presented as a successful live human challenge.
