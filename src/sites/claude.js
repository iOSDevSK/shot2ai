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
  selectors: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
  sendSelectors: ['button[aria-label="Send message"]', 'button[aria-label="Send Message"]'],
  stopSelectors: ['button[aria-label="Stop response"]', 'button[aria-label^="Stop" i]'],
  userSelectors: ['[data-testid="user-message"]'],
  answerSelectors: ['.font-claude-response', '.font-claude-message', '[data-is-streaming]'],
  contentSelectors: ['.font-claude-response', '.font-claude-message'],
  streamingSelectors: ['[data-is-streaming="true"]'],
  loginUrls: ['/login', '/logout'],
  loginSelectors: ['[data-testid="login-with-google"]', 'a[href="/login"]'],
};
