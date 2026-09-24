# Shot2AI shared conversations

Production runs at **https://share.shot2ai.com** on the `shot2ai-share` Cloudflare
Worker. Wrangler manages this custom domain and its certificate. The apex
`shot2ai.com` is not routed to this Worker.

- Private R2 bucket: `shot2ai-conversations`, location hint `WEUR`; no public bucket
  endpoint. Objects under `shares/` have a 30-day lifecycle expiration rule.
- SQLite Durable Object `ShareStore`: persistent upload counters, atomic storage
  reservations and hourly cleanup alarms. Limits are 5 creations/IP/minute,
  30/IP/hour, 100/verified-browser/day, 1,000 total/day, 5 GiB stored, and 50,000 active records. Each upload credential is also capped at 32 MiB and 50 active copies. All credentials on one IP share a 50 MiB active-storage ceiling. Quotas
  survive Worker restarts and release when a copy is deleted.
- Upload authorization: a managed Cloudflare Turnstile verification issues a signed
  30-day bearer credential. The signing key and Turnstile secret exist only as
  Worker secrets. Anonymous, expired and invalid credentials fail before body
  parsing/storage. The Chrome extension contains no server secret.
- Edge request throttling: 120 requests/IP/minute per Cloudflare location, plus
  durable authorization limits (3/IP/minute, 200 total/hour). These mitigate abuse;
  they are not a guarantee against distributed denial of service or a billing cap.
  A bearer upload credential can be used by anyone who steals it, within these
  limits. It grants neither deletion nor Cloudflare administration. Multiple valid
  verifications can obtain multiple credentials: this is bot mitigation, not a
  unique-person identity system. Global quotas fail closed without evicting others.
- Request size: 12 MiB; the extension accepts PNGs up to 8 MiB. No content is
  truncated to meet a limit; oversized conversations can be exported as PDF/MD.
- Worker logs/observability and alternate workers.dev/preview URLs are disabled.
  Cloudflare still processes the network requests needed to host the service.
- Public policy: https://share.shot2ai.com/privacy, built from `../PRIVACY.md`.

## Cloudflare commands

```sh
npm ci --prefix share-server
npm run dev --prefix share-server
npm run check --prefix share-server
npm run deploy --prefix share-server
```

Local dev uses simulated R2/SQLite at `http://127.0.0.1:8791`, never production
storage. `wrangler.jsonc` pins the production origin, resource names and custom
domain. Do not change the Durable Object name or migrations on routine deploys:
that would replace the existing quota/deletion index. Both the R2 bucket and
Durable Object storage must be retained on deployment.

The service accepts only the conversation selected by the user. It stores a
sanitized tree of all saved exchanges, sources and the original PNG (or selected
text). It returns a random 192-bit public URL and a separate deletion capability.
There is no listing endpoint, external content fetch, remote JavaScript or social
login. Links expire after 30 days. Cleanup alarms remove expired records in batches; expired links stop serving
immediately. R2 lifecycle expiration is a second cleanup mechanism.

## Verification configuration

The managed Turnstile widget permits only `share.shot2ai.com`. Its site key is
public in `wrangler.jsonc`. Set secrets interactively; never put their values in
source files, extension assets, shell arguments or logs:

```sh
cd share-server
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put AUTH_SIGNING_SECRET
npx wrangler secret put IP_HASH_SECRET
```

Use a cryptographically random signing secret of at least 32 bytes. Rotate it to
invalidate all upload credentials; existing public links and deletion keys remain
valid. The separate `IP_HASH_SECRET` keeps raw addresses out of the storage index; retain it across routine signing-key rotations so IP quotas persist. Users behind one NAT share the IP quota; changing networks can evade it. The server verifies Turnstile success, hostname and action `authorize`.
The trusted website can return a credential to Chrome only for the extension's
pending, nonce-bound request in its owned top-level verification tab. It cannot
invoke capture, send, delete, or other extension actions.

The public URL is a read capability: anyone with it can view the full copy.
Deletion requires an independent random 256-bit key; only its SHA-256 hash is
stored on the server. There is no account/listing/admin API exposed by the Worker.
R2 remains private. Stored markup is rendered from a sanitized whitelist and
escaped under a restrictive CSP; it cannot execute user scripts or fetch URLs
server-side. Original PNGs are bounded by bytes and pixel dimensions.

The optional Node server/Dockerfile are **local development fixtures**, not the
production security gateway. They lack the Cloudflare verification and durable
rate limits; do not expose them publicly. Production uses `cloudflare.mjs`.

Shared pages include a branded 1200×630 PNG with the capture, question and answer
excerpt for Open Graph/Twitter previews. The original image and full conversation
remain on the page. Robots rules allow the selected social preview fetchers on `/s/` while general crawling stays disallowed; pages also carry noindex headers. Social services control whether and when previews appear. Robots directives are not access controls.
Deleting a share revokes its page, original PNG and preview together; copies
already cached by recipients/social networks cannot be recalled.

Monitor Cloudflare usage and billing notifications separately. Storage/upload
quotas do not cap all request charges. If abuse occurs, disable upload routing,
rotate the signing secret, and adjust Cloudflare edge controls; keep read/deletion
routes available where possible. Protect the owner Cloudflare account with MFA
and scoped deployment credentials; visitor tokens cannot administer Cloudflare.

## Extension setup and release gate

1. Deploy this service to the chosen HTTPS origin with persistent storage.
2. Set `SHARE_ORIGIN` in `src/share-config.js` to that exact origin, without a
   trailing slash. Add `https://YOUR-SHARING-HOST/*` to `manifest.json` host
   permissions. Do not use a temporary tunnel as the shipped origin.
3. With a verified browser credential, create **only synthetic test data** through `/api/shares`. Verify the returned
   `/s/{id}` URL in a separate logged-out browser, including the exact PNG at
   `/s/{id}/image.png`, server-rendered Open Graph metadata and Unicode/history.
4. Reload the extension and exercise its actual card. Verify native WhatsApp's
   recipient chooser and Facebook/X's share composers with the public URL. The
   browser may require permission to open the WhatsApp app. Do not bypass that
   permission or claim that a protocol URL proves native delivery. No real post
   needs to be submitted for this check.
5. Delete the test link in Settings → Privacy → Manage shared links. Check that
   both the page and PNG now return 404. Update the published privacy policy.
6. Bump all extension versions, run Playwright, build the ZIP with
   `python3 scripts/package.py`, and keep `~/Downloads/test/shot2ai` linked to the
   extension. Never ship an unconfigured origin as completed sharing.

## API

`POST /api/shares` takes JSON `{kind, selectedText, url, turns, png}`; `png` is
base64 PNG bytes, omitted for `kind: "text"`. `turns` contain `{asked, answer}`.
Unknown properties are discarded. Success is 201 `{url, expiresAt, deleteToken}`.

`DELETE /api/shares/{id}` needs `Authorization: Bearer {deleteToken}`. The token
is stored only in the extension and must never enter the public URL, page or
social composer. Deletion removes the page and original PNG; recipients and
social networks may have saved their own copies.

Creation is anonymous and public. Origin/CORS is not an authentication mechanism.
The Node limits are process-local; production Cloudflare quotas use persistent
SQLite counters shared across Worker instances. Monitor service usage before
increasing public distribution or quotas.

`GET /health` checks the process. Public reads also support HEAD for link crawlers.

## Checks

```sh
npm ci --prefix share-server
npx playwright test tests/share.spec.mjs tests/share-server.spec.mjs tests/share-cloudflare.spec.mjs
node tests/live-share.mjs
```

The tests use a real local HTTP server and persistent extension context. Social
composer endpoints are intercepted to avoid posts; native-app interaction and
real Facebook/X acceptance require the separate deployment checks above.

The opt-in live test publishes synthetic content only and deletes it afterward.
`SHOT2AI_TEST_IP` can select a verified Cloudflare IP for this test process when a
local DNS resolver caches NXDOMAIN; it does not disable TLS verification or alter
the shipped extension. `SHOT2AI_KEEP_TEST_LINK=1` temporarily retains the synthetic
copy for a separate native-app check; delete it with the private cleanup record.

## Lossless storage format

New R2 objects contain gzip-compressed JSON, with `Content-Encoding: gzip` metadata.
This compresses the full conversation and recovers most Base64 overhead without
resizing screenshots, changing PNG bytes or shortening answers. Quotas count the
actual compressed bytes written to R2, including the social preview. Legacy plain
JSON objects and their existing byte reservations remain valid. The decompressor
is bounded at 13 MiB. Image/PDF/Markdown round-trip tests compare original bytes.
