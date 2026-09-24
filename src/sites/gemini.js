// Gemini (gemini.google.com): where Shot2AI finds the message box, the send
// and stop buttons, the owner's messages and Gemini's answers. Only this file
// follows Gemini's page: when that page changes, this is the file to update.
// Every list is tried in order; a send or an answer that cannot be confirmed
// says so in the card rather than going wrong quietly. Signed out, Google
// sends the tab to its sign-in page, which Shot2AI only notices.
export default {
  id: 'gemini',
  name: 'Gemini',
  // A new chat; a tab already on gemini.google.com is reused as it is.
  url: 'https://gemini.google.com/app',
  selectors: ['rich-textarea .ql-editor[contenteditable="true"]', 'div.ql-editor[contenteditable="true"]', 'div[contenteditable="true"][role="textbox"]'],
  // The input area around the editor, where attached images show.
  areaSelectors: ['.input-area-container', 'input-container', '.text-input-field'],
  // Includes pending/error chips, which need not contain an image element.
  attachmentSelectors: ['uploader-file-preview', 'img'],
  uploadButtonSelectors: ['button[aria-label="Upload and tools"]'],
  uploadErrorSelectors: ['.gem-attachment-loading-error', 'uploader-file-preview-container.has-error'],
  sendSelectors: ['button[aria-label="Send message"]', 'button.send-button'],
  stopSelectors: ['button[aria-label="Stop response"]', 'button[aria-label^="Stop" i]'],
  userSelectors: ['user-query', '.user-query-container'],
  answerSelectors: ['model-response', '.model-response-text'],
  contentSelectors: ['.markdown', 'message-content'],
  // Gemini keeps streamed text hidden until animation frames reveal it.
  backgroundFrames: true,
  // aria-busy also covers presentation animations and can stay true in
  // a hidden tab after generation ends. The stop button tracks generation.
  streamingSelectors: [],
  loginUrls: [],
  loginSelectors: ['a[href*="accounts.google.com/ServiceLogin"]', 'a[href*="accounts.google.com/v3/signin"]'],
  // The mode picker by the message box: its button, the menu it opens
  // (anywhere on the page), the menu's items and the name inside an item.
  // `typical` is shown, labelled as such, only when no Gemini tab has been
  // read yet; the real list is read from the picker itself.
  model: {
    button: ['button[data-test-id="bard-mode-menu-button"]', 'button[aria-label^="Open mode picker"]', 'bard-mode-switcher button', 'button[aria-label*="mode" i][aria-haspopup]'],
    menu: ['[role="menu"]', '.mat-mdc-menu-panel'],
    items: ['[role="menuitemradio"]', 'button[mat-menu-item]', '[role="menuitem"]'],
    label: ['.mode-title', '.title-text', '.label'],
    itemExclude: 'gem-menu-item:not([data-mode-id])',
    checked: 'gem-menu-item.selected',
    closeWithTrigger: true,
    openMenu: '[data-test-id="gem-mode-menu"][data-visible="true"]',
    typical: [],
    effort: {
      kind: 'menu', inModelMenu: true,
      items: ['gem-menu-item:not([data-mode-id])'],
      options: [['standard', 'Standard thinking'], ['high', 'High thinking']],
    },
  },
};
