// Lossless at-rest compression. PNG bytes and complete text round-trip exactly.
// Legacy JSON objects remain readable after deployment.
export async function encodeRecord(record) {
  const stream = new Blob([JSON.stringify(record)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function decodeRecord(object) {
  if (!object) return null;
  if (object.httpMetadata?.contentEncoding !== 'gzip') return object.json();
  const reader = object.body.pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 13 * 1024 * 1024) { await reader.cancel(); throw new Error('Stored conversation exceeds the read limit'); }
    chunks.push(value);
  }
  return JSON.parse(await new Blob(chunks).text());
}
