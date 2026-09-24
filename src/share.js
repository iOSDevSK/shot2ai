import { getCapture } from './captures.js';
import { putExport } from './share-store.js';
import { publishCapture, socialURL } from './public-share.js';

export async function shareConversation(message, sender) {
  if (!['whatsapp', 'facebook', 'x', 'pdf', 'md'].includes(message.format)) return { ok: false, text: 'Unknown export format.' };
  const capture = await getCapture(message.id);
  if (!capture?.answer || !sender?.tab || capture.tabId !== sender.tab.id) return { ok: false, text: 'This conversation is no longer available.' };
  if (['sending', 'answering'].includes(capture.answer.state)) return { ok: false, text: 'Wait for the answer before sharing.' };
  if (['whatsapp', 'facebook', 'x'].includes(message.format)) {
    try {
      const { url } = await publishCapture(capture);
      if (message.format === 'whatsapp') {
        // A visible handoff page permits a native-app retry if Chrome blocks the
        // automatic protocol launch, without losing the prefilled public link.
        const launch = new URL(chrome.runtime.getURL('src/share-launch.html'));
        launch.search = new URLSearchParams({ url });
        await chrome.tabs.create({ url: launch.href });
      } else await chrome.tabs.create({ url: socialURL(message.format, url) });
      return { ok: true, url };
    } catch (e) { return { ok: false, text: e.message || 'The conversation could not be shared. Try again.' }; }
  }
  const id = await putExport(capture);
  const url = new URL(chrome.runtime.getURL('src/share.html'));
  url.search = new URLSearchParams({ id, format: message.format });
  await chrome.tabs.create({ url: url.href });
  return { ok: true };
}
