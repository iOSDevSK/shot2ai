// The right-click menu.
import { destinations, defaultDestination, update, prompts } from './settings.js';
import { startCapture, captureVisible, captureImage, captureSavedRegion } from './capture.js';
import { showCard } from './flow.js';

const CONTEXTS = ['page', 'selection', 'image', 'link'];
export async function menuItems() {
  const [list, chosen, saved] = await Promise.all([destinations(), defaultDestination(), prompts()]);
  const to = { copy: ['Capture and copy', 'Copy this image'], save: ['Capture and save', 'Save this image'] }[chosen.kind]
    || [`Capture and send to ${chosen.name}`, `Send this image to ${chosen.name}`];
  const item = (id, title, extra = {}) => ({ id, parentId: 'shot2ai', contexts: CONTEXTS, ...(title ? { title } : {}), ...extra });
  return [
    { id: 'shot2ai', title: 'Shot2AI', contexts: CONTEXTS },
    item('capture-area', 'Capture area…'),
    item('capture-visible', 'Capture visible page'),
    item('capture-saved', 'Capture saved region'),
    item('sep-1', '', { type: 'separator' }),
    item('send-to', 'Send to'),
    ...list.map((d) => ({ id: `dest:${d.id}`, parentId: 'send-to', title: d.name, type: 'radio', checked: d.id === chosen.id, contexts: CONTEXTS })),
    item('capture-send', to[0]),
    ...(saved.length ? [item('prompts', 'Send with prompt')] : []),
    ...saved.map((p) => ({ id: `prompt:${p.id}`, parentId: 'prompts', title: p.name.slice(0, 60), contexts: CONTEXTS })),
    item('send-image', to[1], { contexts: ['image'] }),
    item('send-selection', 'Send selection with a screenshot', { contexts: ['selection'] }),
    item('sep-2', '', { type: 'separator' }),
    item('options', 'Options'),
  ];
}
// One rebuild at a time, so ids never clash.
let building = Promise.resolve();
export function rebuildMenu() {
  building = building.then(async () => {
    await chrome.contextMenus.removeAll();
    for (const entry of await menuItems()) chrome.contextMenus.create(entry, () => void chrome.runtime.lastError);
  }).catch(() => {});
  return building;
}
export async function onMenuClick(info, tab) {
  const id = String(info.menuItemId);
  if (id === 'options') { await chrome.runtime.openOptionsPage(); return; }
  if (id.startsWith('dest:')) { await update({ defaultDestination: id.slice(5) }); return; }
  if (!tab?.id) return;
  if (id === 'capture-area') { await startCapture(tab.id); return; }
  if (id === 'capture-saved') {
    const result = await captureSavedRegion(tab);
    if (result) await showCard(tab.id, result.id, result.capture);
    return;
  }
  if (id === 'send-image' && info.srcUrl) {
    const { id: captureId, capture } = await captureImage(info.srcUrl, tab);
    await showCard(tab.id, captureId, capture);
    return;
  }
  const { id: captureId, capture } = await captureVisible(tab);
  if (id === 'capture-visible') await showCard(tab.id, captureId, capture);
  if (id === 'capture-send') await showCard(tab.id, captureId, capture, { autoSend: true });
  if (id.startsWith('prompt:')) {
    const prompt = (await prompts()).find((p) => p.id === id.slice(7));
    await showCard(tab.id, captureId, capture, { text: prompt?.text || '', autoSend: true });
  }
  if (id === 'send-selection') await showCard(tab.id, captureId, capture, { text: (info.selectionText || '').trim().slice(0, 2000) });
}
