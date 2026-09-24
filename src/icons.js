// Line icons on a 24px grid, drawn for this extension.
const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const icons = {
  code: svg('<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.5 5l-3 14"/>'),
  arrow: svg('<path d="M5 19 18.5 5.5M10 5.5h8.5V14"/>'),
  rect: svg('<rect x="3.5" y="6" width="17" height="12" rx="2.2"/>'),
  text: svg('<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/>'),
  highlight: svg('<path d="m14.5 4.5 5 5-8.5 8.5H6v-5z"/><path d="M4 21h16" stroke-width="2.4" opacity=".55"/>'),
  blur: svg('<rect x="4" y="4" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="4" width="4.5" height="4.5" rx="1" opacity=".45"/><rect x="15.5" y="4" width="4.5" height="4.5" rx="1"/><rect x="4" y="9.75" width="4.5" height="4.5" rx="1" opacity=".45"/><rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="15.5" y="9.75" width="4.5" height="4.5" rx="1" opacity=".45"/><rect x="4" y="15.5" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="15.5" width="4.5" height="4.5" rx="1" opacity=".45"/><rect x="15.5" y="15.5" width="4.5" height="4.5" rx="1"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  send: svg('<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>'),
  capture: svg('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>'),
  retry: svg('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  region: svg('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" stroke-dasharray="2.5 2.5"/><circle cx="12" cy="12" r="2.5"/>'),
  fullpage: svg('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18" stroke-width="2.4"/>'),
  chevron: svg('<path d="m7 14.5 5-5 5 5" stroke-width="2"/>'),
  annotate: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  spinner: svg('<path d="M12 3a9 9 0 1 0 9 9" />'),
  open: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'),
  share: svg('<path d="M7 9H5v12h14V9h-2M12 15V2M8 6l4-4 4 4"/>'),
  whatsapp: svg('<path d="M4 17 3 21l4-1a9 9 0 1 0-3-3Z"/><path d="M8 7c0 5 4 9 8 9l1-3-3-1-1 1-2-2 1-1-1-3z"/>'),
  facebook: svg('<path d="M14 21v-8h3l1-4h-4V7c0-1 1-2 2-2h2V2h-3c-3 0-5 2-5 5v2H7v4h3v8"/>'),
  x: svg('<path d="m4 3 12 18h4L8 3zM20 3l-7 8M4 21l7-8"/>'),
  pdf: svg('<path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h8"/>'),
  md: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 15V9l3 3 3-3v6M17 9v6m-2-2 2 2 2-2"/>'),
  chat: svg('<path d="M7 4.5h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H9l-5 3v-4a4 4 0 0 1-1-3v-6a4 4 0 0 1 4-4Z"/><circle cx="8" cy="11.5" r=".8" fill="currentColor" stroke="none"/><circle cx="12" cy="11.5" r=".8" fill="currentColor" stroke="none"/><circle cx="16" cy="11.5" r=".8" fill="currentColor" stroke="none"/>'),
  grip: svg('<path d="M5 11 11 5M5 17 17 5M11 17l6-6" stroke-width="1.6"/>'),
};
export function paint(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.insertAdjacentHTML('afterbegin', icons[el.dataset.icon] || '');
}
