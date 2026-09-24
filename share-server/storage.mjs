import { mkdir, readFile, writeFile, rename, unlink, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export function fileStorage(directory, maxBytes = 512 * 1024 * 1024) {
  const path = id => { if (!/^[A-Za-z0-9_-]{32}$/.test(id)) throw new Error('Invalid id'); return join(directory, `${id}.json`); };
  let queue = Promise.resolve();
  const serial = action => { const result = queue.then(action); queue = result.catch(() => {}); return result; };
  return {
    async get(id) { try { return JSON.parse(await readFile(path(id), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } },
    async delete(id) { await unlink(path(id)).catch(e => { if (e.code !== 'ENOENT') throw e; }); },
    put(id, record) { return serial(async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const body = JSON.stringify(record), files = await readdir(directory);
      let used = Buffer.byteLength(body);
      for (const f of files) if (f.endsWith('.json')) used += (await stat(join(directory, f)).catch(() => ({ size: 0 }))).size;
      if (used > maxBytes) throw new Error('Storage capacity reached');
      const temp = `${path(id)}.tmp`;
      await writeFile(temp, body, { mode: 0o600 }); await rename(temp, path(id));
    }); },
    prune(now) { return serial(async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      for (const f of await readdir(directory)) {
        if (!/^[A-Za-z0-9_-]{32}\.json$/.test(f)) continue;
        try { const r = JSON.parse(await readFile(join(directory, f), 'utf8')); if (r.expiresAt <= now) await unlink(join(directory, f)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
    }); },
  };
}
