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
  selectors: ['[data-composer-markdown][contenteditable="true"]', '#prompt-textarea', '[contenteditable="true"][aria-label="Ask ChatGPT"]', '[data-composer-body] [contenteditable="true"]', 'form div[contenteditable="true"].ProseMirror'],
  strictComposer: true,
  composerExclude: 'article, [data-message-author-role], [data-testid^="conversation-turn"], .writing-block-editor',
  areaSelectors: ['[data-composer-body]'],
  sendSelectors: ['button[data-testid="send-button"]', '#composer-submit-button', 'button[aria-label="Send prompt"]'],
  stopSelectors: ['button[data-testid="stop-button"]', 'button[aria-label="Stop streaming"]', 'button[aria-label^="Stop" i]'],
  userSelectors: ['[data-message-author-role="user"]', '[data-user-message-bubble="true"]'],
  messageIdentity: ['data-chatgpt-search-message-ids', 'data-message-id', 'data-content-search-unit-key'],
  answerSelectors: ['[data-message-author-role="assistant"]', '[data-content-search-unit-key]:has(> [data-conversation-role="assistant"])'],
  contentSelectors: ['[data-markdown-text-style="assistant-message"]', '.markdown'],
  backgroundFrames: true,
  streamingSelectors: ['.result-streaming'],
  loginUrls: ['/auth/login', '/log-in'],
  loginSelectors: ['[data-testid="login-button"]'],
  // The model picker in the header or composer: its button, the menu it opens
  // (anywhere on the page), the menu's items and the name inside an item.
  // `typical` is shown, labelled as such, only when no ChatGPT tab has been
  // read yet; the real list is read from the picker itself.
  model: {
    readyTimeout: 6000,
    button: ['button[data-codex-intelligence-trigger]', 'button[aria-label="Select ChatGPT model"]', 'button[data-testid="model-switcher-dropdown-button"]', 'button[aria-label^="Model selector" i]', 'button[aria-label*="model" i][aria-haspopup]'],
    buttonExclude: 'article, [data-message-author-role], [data-testid^="conversation-turn"]',
    // The composer picker can show only "Instant" (no model test ID or
    // accessible label). Match a mode or versioned GPT name in the composer,
    // never a similarly named button in the conversation or sidebar.
    buttonFallback: [':is(form, [data-type="unified-composer"], #thread-bottom-container):has(#prompt-textarea) :is(button, [role="button"])[aria-haspopup]'],
    // Applied to normalized text, so GPT-5.5 and GPT 5.5 both identify the
    // trigger. This does not add names to the menu or alias a model to a mode.
    buttonNamePattern: /^(?:gpt ?\d+(?:\.\d+)*|\d+\.\d+(?:\.\d+)*)(?: ?sol)?(?: ?(?:auto|instant|thinking|pro|medium|high|extra high|light|standard|extended|heavy))?$/.source,
    // The newer UI puts the model inside the Thinking effort popover.
    // Effort positions are read from the slider's bounds, not model versions.
    effort: {
      buttons: ['button[data-codex-intelligence-trigger]', ':is(form, [data-type="unified-composer"], #thread-bottom-container):has(#prompt-textarea) :is(button, [role="button"])'],
      names: ['Thinking effort', 'Instant', 'Medium', 'High', 'Extra High', 'Pro'],
      sliders: ['input[type="range"]', '[role="slider"]'],
      keyboardTarget: '[role="menuitem"][aria-label="Power"]',
      valueLabel: '[aria-label="Select model"] [data-max-effort], [data-model-picker-view-toggle] [data-effort-only]',
    },
    // The intelligence picker switches views inside one menu. The model
    // radios remain mounted but inert until Select model is activated.
    panel: {
      // The model view resets after the close animation, even when the menu
      // DOM is already gone. Reopening sooner keeps the effort slider inert.
      settleMs: 400,
      root: '[data-testid="composer-intelligence-picker-content"], [data-model-picker-view]',
      toggle: '[role="menuitem"][aria-label="Select model"]',
      models: '[data-testid="composer-model-picker-slider-advanced-view"], [data-model-picker-view] [role="menuitemradio"]',
    },
    namePrefix: /^gpt\s*/.source,
    menu: ['[role="menu"]', '[role="listbox"]'],
    items: ['[role="menuitemradio"]', '[role="menuitem"]', '[role="option"]'],
    label: [],
    // Old mode names remain valid trigger labels, but are not offered as models.
    buttonNames: ['Auto', 'Instant', 'Thinking', 'Pro'],
    typical: [],
  },
};
