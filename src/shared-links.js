import { sharedLinks, deleteSharedLink, validateShareURL } from './public-share.js';
async function render() {
  const records = await sharedLinks(), list = document.getElementById('links'); list.replaceChildren();
  if (!records.length) { list.textContent = 'No active shared links.'; return; }
  for (const record of records) {
    const section = document.createElement('section'); section.className = 'turn';
    const title = document.createElement('h2'); title.textContent = record.title;
    const link = document.createElement('a'); link.textContent = record.url;
    if (validateShareURL(record.url)) { link.href = record.url; link.target = '_blank'; link.rel = 'noreferrer noopener'; }
    const date = document.createElement('p'); date.textContent = `Expires ${new Date(record.expiresAt).toLocaleDateString()}`;
    const button = document.createElement('button'); button.textContent = 'Delete shared link';
    button.onclick = async () => { button.disabled = true;
      try { await deleteSharedLink(record.key); document.getElementById('status').textContent = 'Shared link deleted.'; await render(); }
      catch { document.getElementById('status').textContent = 'Could not delete the link. Check your connection and try again.'; button.disabled = false; }
    };
    section.append(title, link, date, button); list.append(section);
  }
}
render().catch(() => { document.getElementById('status').textContent = 'Shared links could not be loaded.'; });
