// The capture stack: every capture of a tab stays until it is sent, closed
// or cleared, so the card can show them as a deck. It lives in the capture
// store (IndexedDB), keyed by tab, and survives navigation within the tab.
import { allCaptures, updateCapture, deleteCapture } from './captures.js';

export const STACK_CAP = 20;

export async function stackFor(tabId) {
  return (await allCaptures()).filter((c) => c.stack?.tabId === tabId).sort((a, b) => a.stack.addedAt - b.stack.addedAt);
}

// Adds a capture; beyond the cap the oldest go. Returns how many went.
export async function addToStack(tabId, id, fields) {
  await updateCapture(id, { ...fields, stack: { tabId, addedAt: Date.now() } });
  const list = await stackFor(tabId);
  let dropped = 0;
  while (list.length > STACK_CAP) {
    await deleteCapture(list.shift().id);
    dropped += 1;
  }
  return dropped;
}

export async function clearStack(tabId) {
  for (const c of await stackFor(tabId)) await deleteCapture(c.id);
}

// Tabs whose stack the owner put away with Esc: not shown again on navigation.
const hidden = new Set();
export const hideStack = (tabId) => hidden.add(tabId);
export const unhideStack = (tabId) => hidden.delete(tabId);
export const stackHidden = (tabId) => hidden.has(tabId);
