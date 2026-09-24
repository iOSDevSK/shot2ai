import { test, expect } from '@playwright/test';
import { encodeRecord, decodeRecord } from '../share-server/record-codec.mjs';
const object = bytes => ({ httpMetadata: { contentEncoding: 'gzip' }, body: new Blob([bytes]).stream() });
test('stored gzip preserves every PNG byte, complete Unicode history and deletion hash', async () => {
  const record = { png: Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 256)).toString('base64'), preview: null, snapshot: { turns: [{ asked: 'Čo vidíš? 👋', answer: { blocks: [{ t: 'p', c: ['Complete text čšťž. '.repeat(400)] }] } }] }, deleteHash: 'a'.repeat(64), expiresAt: 1900000000000 };
  const compressed = await encodeRecord(record);
  expect(compressed.length).toBeLessThan(Buffer.byteLength(JSON.stringify(record)) / 2);
  expect(await decodeRecord(object(compressed))).toEqual(record);
  expect(await decodeRecord({ httpMetadata: {}, json: async () => record })).toEqual(record);
});
test('corrupt compressed objects fail closed and expanded content is bounded', async () => {
  await expect(decodeRecord(object(new Uint8Array([1, 2, 3])))).rejects.toThrow();
  const huge = await encodeRecord({ text: 'x'.repeat(14 * 1024 * 1024) });
  await expect(decodeRecord(object(huge))).rejects.toThrow('read limit');
});
