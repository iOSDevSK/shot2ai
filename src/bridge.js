// Talks to the html2wp app on this computer. The app listens on 127.0.0.1
// only, on the first free port of a small range. Nothing here reaches any
// other host. Reasons why the chat cannot take a message come from the app
// and are shown as they are.
export const PORTS = [47811, 47812, 47813, 47814, 47815];

async function saved() {
  const { token = null, port = null } = await chrome.storage.local.get(['token', 'port']);
  return { token, port };
}

async function request(port, path, { method = 'GET', token = null, body = null, timeout = 2500 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store', signal: AbortSignal.timeout(timeout),
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}

// Find the app: the last port that answered first, then the whole range.
// Returns { port, status } or null when html2wp is not running.
export async function connect() {
  const { token, port: last } = await saved();
  const order = last ? [last, ...PORTS.filter((p) => p !== last)] : PORTS;
  for (const port of order) {
    try {
      const { status, data } = await request(port, '/status', { token, timeout: 1200 });
      if (status === 200 && data?.app === 'html2wp') {
        if (port !== last) await chrome.storage.local.set({ port });
        return { port, status: data };
      }
    } catch { /* not here: try the next port */ }
  }
  return null;
}

// Pair with the 6-digit code shown in html2wp Settings.
// Returns 'paired', 'wrong-code' or 'offline'.
export async function pair(code) {
  const found = await connect();
  if (!found) return 'offline';
  const { status, data } = await request(found.port, '/pair', { method: 'POST', body: { code } });
  if (status === 200 && data?.token) {
    await chrome.storage.local.set({ token: data.token, port: found.port });
    return 'paired';
  }
  return 'wrong-code';
}

export async function forget() {
  await chrome.storage.local.remove('token');
}

// Send the annotated screenshot and the message into the open project's chat.
// Returns { ok } | { reason } (the app's own words) | { unpaired } | { tooLarge } | { offline }.
export async function send(port, projectId, text, pngBase64) {
  const { token } = await saved();
  let result;
  try {
    // Starting the assistant's turn can take a while; allow for it.
    result = await request(port, '/message', {
      method: 'POST', token, timeout: 120000,
      body: { token, projectId, text, imagePng: pngBase64 },
    });
  } catch {
    return { offline: true };
  }
  const { status, data } = result;
  if (status === 200 && data?.ok) return { ok: true };
  if (status === 409 && data?.reason) return { reason: data.reason };
  if (status === 401) { await forget(); return { unpaired: true }; }
  if (status === 413) return { tooLarge: true };
  return { offline: true };
}

export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// The whole html2wp send: find the app, check its chat, send.
// Returns { ok, project } | { reason } | { unpaired } | { tooLarge } | { offline }.
export async function sendToApp(text, png) {
  const found = await connect();
  if (!found) return { offline: true };
  const { status } = found;
  if (!status.paired) return { unpaired: true };
  if (!status.chat?.available) return { reason: status.chat?.reason || '' };
  const outcome = await send(found.port, status.project.id, text, await blobToBase64(png));
  return { ...outcome, project: status.project };
}

// What to tell the owner. A reason from the app is shown as it is.
export function outcomeText(outcome) {
  if (outcome.ok) return `Sent to ${outcome.project?.name || 'html2wp'}`;
  if (outcome.reason !== undefined) return outcome.reason;
  if (outcome.unpaired) return 'Pair with html2wp first: enter the code from html2wp Settings in the extension.';
  if (outcome.tooLarge) return 'The screenshot is larger than 10 MB. Capture a smaller area.';
  return 'html2wp is not running. Open the app on this Mac, then try again.';
}
