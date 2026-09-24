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
  sendSelectors: ['button[aria-label="Send message"]', 'button.send-button'],
  stopSelectors: ['button[aria-label="Stop response"]', 'button[aria-label^="Stop" i]'],
  userSelectors: ['user-query', '.user-query-container'],
  answerSelectors: ['model-response', '.model-response-text'],
  contentSelectors: ['.markdown', 'message-content'],
  streamingSelectors: [],
  loginUrls: [],
  loginSelectors: ['a[href*="accounts.google.com/ServiceLogin"]', 'a[href*="accounts.google.com/v3/signin"]'],
};
