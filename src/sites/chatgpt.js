// ChatGPT (chatgpt.com): where Shot2AI finds the message box, the send and
// stop buttons, the owner's messages and ChatGPT's answers. Only this file
// follows ChatGPT's page: when that page changes, this is the file to update.
// Every list is tried in order; a send or an answer that cannot be confirmed
// says so in the card rather than going wrong quietly.
export default {
  id: 'chatgpt',
  name: 'ChatGPT',
  // A new chat; a tab already on chatgpt.com is reused as it is.
  url: 'https://chatgpt.com/',
  selectors: ['#prompt-textarea', 'div[contenteditable="true"].ProseMirror'],
  sendSelectors: ['button[data-testid="send-button"]', '#composer-submit-button', 'button[aria-label="Send prompt"]'],
  stopSelectors: ['button[data-testid="stop-button"]', 'button[aria-label="Stop streaming"]', 'button[aria-label^="Stop" i]'],
  userSelectors: ['[data-message-author-role="user"]'],
  answerSelectors: ['[data-message-author-role="assistant"]'],
  contentSelectors: ['.markdown'],
  streamingSelectors: ['.result-streaming'],
  loginUrls: ['/auth/login', '/log-in'],
  loginSelectors: ['[data-testid="login-button"]'],
};
