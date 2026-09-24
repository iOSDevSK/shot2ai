# Shot2AI 0.5.15 — public sharing and abuse limits

Production: https://share.shot2ai.com, Cloudflare Worker `shot2ai-share` with
private R2 bucket `shot2ai-conversations` and SQLite Durable Object `ShareStore`.
No other R2 bucket is bound to this Worker or changed by its lifecycle rules.

## Delivered behavior

- WA/FB/X publish a sanitized snapshot and open a share composer with its URL.
  WhatsApp uses its native protocol with a web fallback. The platform still asks
  the user to pick a recipient/audience and confirm sending.
- Branded 1200×630 social preview, exact original PNG, complete saved history,
  Unicode and sources. Drafts and private AI conversation URLs are excluded.
- New R2 records use lossless gzip; old JSON records remain readable. Quotas
  count stored bytes. No screenshot resizing or answer summarization is applied.
- Delete a copy in Settings → Privacy → Manage shared links. A separate random
  256-bit capability is required; it is absent from the public URL/HTML. Deletion
  revokes page, PNG and preview. Links expire after 30 days; cleanup uses an alarm
  and a bucket-scoped lifecycle backup.
- Upload requires a signed 30-day credential after managed Turnstile verification.
  The server checks challenge success/hostname/action. Credential callback checks
  the trusted origin, owned top-level tab and single-use pending nonce.
- Global storage: 5 GiB. Per credential: 32 MiB and 50 active copies. Per IP:
  50 MiB across credentials. Upload rates: 5/IP/minute, 30/IP/hour,
  100/credential/day and 1,000 total/day. Reservations/counters survive restarts.
- Secrets remain in Cloudflare Worker secrets, never in the extension ZIP.
  IP storage accounting uses a keyed hash, not stored raw IP addresses.

## Verification

- Final ZIP unpacked into `/tmp/shot2ai-0515-release-check`: **36 tests passed**
  across sharing, security, codec, Cloudflare and card regressions. Log:
  `/tmp/shot2ai-0515-packaged-tests.log`.
- Production deployment version: `95526c35-458c-4a1d-b811-78b70f396838`.

- Full regression run: 145 passed, 6 intentionally skipped (hidden Gemini paths),
  one local Wrangler integration failed with Miniflare `Network connection lost`
  rather than the expected rejected-challenge response. Log:
  `/tmp/shot2ai-0515-final-regression.log`. This initial run was not fully green. The unread-body service-boundary problem
  was then fixed by rejecting unauthorized uploads in the outer Worker before
  Durable Object forwarding. The previously failing case passed 12 consecutive
  isolated runs: `/tmp/shot2ai-denial-edge.log`.
- Targeted sharing tests exercise real extension runtime/card actions, a real
  local HTTP server, PDF generation, MD bytes, complete history, DOM injection
  protection, public metadata, ownership, deletion, and schema compatibility.
- Cloudflare tests run actual Wrangler/workerd with temporary R2/SQLite storage:
  persistence, concurrent global quota reservations, separate per-token quotas,
  shared per-IP quotas across different credentials, deletion releasing quota,
  anonymous/forged/expired credentials and cross-owner deletion rejection.
- Compression tests verify exact data round-trip, old-record compatibility,
  malformed gzip rejection and bounded decompression.
- Real production HTTPS test used only synthetic content: upload with an
  administrator-issued fixture credential, unauthenticated upload rejection,
  forged deletion rejection, public desktop/mobile page, original PNG bytes,
  preview dimensions, policy and deletion of all three public resources (404).
  Logs: `/tmp/shot2ai-0515-compressed-live.log` and final packaged run
  `/tmp/shot2ai-0515-release-live.log`. All synthetic public copies were deleted;
  the temporary administrator secret file was removed.
- The Chrome external-message handshake was tested with mocked Turnstile provider
  boundaries. The real managed Turnstile widget loaded but rejected the automated
  browser. A positive human challenge completion has NOT been verified. Normal
  Google Chrome disallowed JavaScript via Apple Events; no setting was changed.
- Real FB/X share URLs were opened without submitting posts. The isolated browser
  was not signed in. Native WhatsApp recipient selection/delivery remains
  unconfirmed; a protocol URL alone is not proof of delivery.
- Release script checks synchronized version fields, ZIP references/integrity
  and exclusion of server code/secrets. JavaScript syntax and `git diff --check`
  passed.

## Remaining identity decision

These are anonymous browser credentials, not verified human accounts. A changed
IP does not change the quota of an existing credential, and another credential
on the same IP still shares its IP quota. However, new credentials plus new IPs
can evade those individual ceilings. Global limits continue to hold.

Hardware fingerprinting is not used or presented as an identity guarantee.
A quota tied to a logged-in author requires a chosen identity provider and OAuth
configuration. Google/GitHub preference is pending; account authentication is
not implemented or represented as deployed in this release. Multiple accounts
would still need abuse controls and the global storage ceiling.

R2 free-tier usage is shared with the owner's other buckets, including backups.
The Shot2AI quota does not cap the entire Cloudflare bill. R2 operation charges,
provider caches and copies saved by recipients remain outside these controls.
