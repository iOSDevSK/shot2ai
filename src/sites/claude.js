// Claude (claude.ai): where Shot2AI finds the message box, the send and stop
// buttons, the owner's messages and Claude's answers. Only this file follows
// Claude's page: when that page changes, this is the file to update. Every
// list is tried in order; a send or an answer that cannot be confirmed says
// so in the card rather than going wrong quietly.
export default {
  id: 'claude',
  name: 'Claude',
  // A new chat; a tab already on claude.ai is reused as it is.
  url: 'https://claude.ai/new',
  selectors: ['[data-testid="chat-input"][contenteditable="true"]', 'div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
  // The current composer nests its textbox deeply. The nearest send-button
  // wrapper excludes attachment thumbnails, and its file input is more than
  // eight ancestors away. Read the complete composer fieldset instead.
  areaSelectors: ['fieldset[data-perf-region="composer"]', 'fieldset:has([data-testid="chat-input"])'],
  attachmentSelectors: ['[data-testid="file-thumbnail"]'],
  sendSelectors: ['button[aria-label="Send message"]', 'button[aria-label="Send Message"]'],
  stopSelectors: ['button[aria-label="Stop response"]', 'button[aria-label^="Stop" i]'],
  userSelectors: ['[data-testid="user-message"]'],
  answerSelectors: ['.font-claude-response', '.font-claude-message', '[data-is-streaming]'],
  contentSelectors: ['.font-claude-response', '.font-claude-message'],
  streamingSelectors: ['[data-is-streaming="true"]'],
  loginUrls: ['/login', '/logout'],
  loginSelectors: ['[data-testid="login-with-google"]', 'a[href="/login"]'],
  // The model picker by the message box: its button, the menu it opens
  // (anywhere on the page), the menu's items and the name inside an item.
  // `typical` is shown, labelled as such, only when no Claude tab has been
  // read yet; the real list is read from the picker itself.
  model: {
    button: ['button[data-testid="model-selector-dropdown"]', 'button[aria-label*="model" i][aria-haspopup]'],
    menu: ['[role="menu"]', '[role="listbox"]'],
    items: ['[role="menuitemradio"]', '[role="menuitem"]', '[role="option"]'],
    label: ['[data-testid="model-name"]'],
    typical: ['Opus', 'Sonnet', 'Haiku'],
    effort: {
      kind: 'menu', triggerName: 'Effort',
      options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['extra', 'Extra'], ['max', 'Max']],
    },
  },
};
