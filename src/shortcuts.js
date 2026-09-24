// Keyboard shortcuts. Chrome owns the keys: the extension suggests them in
// its manifest, the owner changes them at chrome://extensions/shortcuts, and
// a key another extension already uses stays unset. Shot2AI only reads them.
export const ACTIONS = [
  { command: 'capture-area', label: 'Capture area' },
  { command: 'capture-visible', label: 'Capture visible page' },
  { command: 'capture-full', label: 'Capture full page' },
  { command: 'capture-saved', label: 'Capture saved region' },
  { command: 'send-text', label: 'Send selected text (no image)' },
  { command: 'show-stack', label: "Show this tab's captures" },
];
export const SHORTCUTS_PAGE = 'chrome://extensions/shortcuts';

// { command: shortcut } as Chrome reports it now ('' when unset). Chrome
// already writes it the platform's way: ⌥⇧S on a Mac, Alt+Shift+S elsewhere.
export async function shortcuts() {
  const list = await chrome.commands.getAll().catch(() => []);
  return Object.fromEntries(list.map((c) => [c.name, c.shortcut || '']));
}
