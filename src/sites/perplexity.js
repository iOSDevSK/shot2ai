// Perplexity (www.perplexity.ai): where Shot2AI finds the message box, the
// send and stop buttons, the owner's questions, Perplexity's answers and the
// sources it lists with them. Only this file follows Perplexity's page: when
// that page changes, this is the file to update. Every list is tried in
// order; a send or an answer that cannot be confirmed says so in the card.
// Signed out, Perplexity still shows its message box; an upload it refuses
// (a sign-in, a plan, a limit) is reported in the card with its own words.
export default {
  id: 'perplexity',
  name: 'Perplexity',
  // A new thread; a tab already on perplexity.ai is reused as it is.
  url: 'https://www.perplexity.ai/',
  selectors: ['#ask-input', 'textarea[placeholder*="Ask" i]', 'div[contenteditable="true"][role="textbox"]'],
  sendSelectors: ['button[aria-label="Submit"]', 'button[data-testid="submit-button"]'],
  stopSelectors: ['button[aria-label="Stop generating response"]', 'button[data-testid="stop-generating-response-button"]', 'button[aria-label^="Stop" i]'],
  userSelectors: ['[data-testid="user-query"]', 'div[class*="group/query"]', 'h1[class*="query"]'],
  answerSelectors: ['div[id^="markdown-content"]', '[data-testid="answer"] .prose', '.prose'],
  contentSelectors: [],
  streamingSelectors: [],
  // The question's entry on the page, and the source links in it.
  entrySelectors: ['[data-testid="answer-entry"]', 'div[class*="group/answer"]'],
  sourceSelectors: ['[data-testid*="source" i] a[href]', 'a[data-testid*="citation" i]', 'a.citation', '.citation a'],
  loginUrls: ['/login', '/signin'],
  loginSelectors: [],
  // The model picker by the message box, which Perplexity offers with Pro:
  // its button, the menu it opens (anywhere on the page), the menu's items
  // and the name inside an item. Without Pro there is no picker, and
  // `noPicker` is what the card says. No typical names: the list depends on
  // the plan, so it is only ever read from the picker itself.
  model: {
    button: ['button[aria-label="Choose a model"]', 'button[aria-label*="model" i][aria-haspopup]'],
    menu: ['[role="menu"]', '[role="listbox"]'],
    items: ['[role="menuitemradio"]', '[role="option"]', '[role="menuitem"]'],
    label: [],
    typical: [],
    noPicker: 'choosing a model needs Perplexity Pro, and no model picker was found',
  },
};
