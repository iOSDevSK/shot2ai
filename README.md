# Shot2AI — Screenshot, Annotate & Send to AI

Shot2AI is a Chrome extension for sending screenshots to AI. Its main job is reporting a problem in an html2wp conversion without leaving Chrome. Drag a rectangle over the part of the page that is wrong and send it, with a message, straight into the chat of the project you have open in the html2wp app. It takes one click from the preview card; you can open the editor first to add arrows, boxes, text, highlight or blur. You can also send the screenshot to ChatGPT, Claude or Perplexity, whose answer then appears in the card on your page, or to any other web chat, or save a copy.

If the chat cannot take a message right now, for example while the assistant is still working, the extension shows the app's own reason and keeps your annotation. Choose **Try again** when the app is ready.

## Install

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Choose **Load unpacked** and select this folder (the one with `manifest.json`).
3. Pin **Shot2AI** to the toolbar if you like.

## Where screenshots go

Out of the box the default destination is **ChatGPT**. The popup's **Captures go to** list shows it and changes it on the spot: ChatGPT, Claude, Perplexity, html2wp (Mac app), your own chats, Copy only or Save only, in the same order as **Options → Default destination**, and the two stay in step. Choosing a web chat there asks Chrome for that one site straight away; if you decline, the choice stays and the popup shows **Needs permission** with an **Allow <chat>** button. The card's main button reads **Send to <default>** (or **Copy** / **Save**). Other chats you turn on stay in the card's menu (the chevron), which sends one screenshot elsewhere without changing the default.

The html2wp status (running, pairing, open project, chat ready) appears only when html2wp is the default. It also appears when you pick html2wp in the card's menu: the card then says whether the app is running, paired and ready.

## Right-click menu

Right-click any page, selection, image or link and choose **Shot2AI**:

- **Capture area…** starts the area selection.
- **Capture visible page** takes the whole visible part of the page straight to the preview card.
- **Capture saved region** captures this site's remembered region (see Saved region).
- **Send to ▸** lists your destinations with a mark on the default. Picking one makes it the default for the next capture.
- **Capture and send to <default>** captures the visible page and sends it at once. The card only shows the result; the first send to a web chat still asks you to confirm once.
- **Send with prompt ▸** captures the visible page and sends it with one of your saved prompts.
- **Send this image to <default>** (on an image) takes the image itself, or cuts it out of a capture of the page when the site does not allow reading it, and opens the card.
- **Send selected text…** opens a text-only card with the selected text and your default prompt. No screenshot is captured or attached.
- **Send selection with a screenshot** (on selected text) captures the visible page and puts the selected text in the message.
- **Options**.

A click on the menu gives Shot2AI access to that tab for the capture, as the toolbar button does.

## Pair with html2wp, once (only if you use html2wp)

1. In html2wp, open **Settings → Chrome extension**. It shows a 6-digit pairing code.
2. Click the Shot2AI toolbar icon and enter the code. You can also enter it in Shot2AI's Options.

Each code pairs one extension. After five wrong codes the code stops working; choose **New code** in Settings. **Unpair** in Settings revokes the extension.

## Send selected text

Select text on a page (including text selected with Shift + arrow keys), then press **Alt+Shift+T** (**⌥⇧T** on Mac). A card previews exactly that selection and prefills the first saved prompt. Choose another prompt or type your own, then press **Enter** or **Send**. An empty prompt field uses the first saved prompt. The outgoing message contains the prompt, a blank line and the selected text, with no image attachment.

The same action is available as **Shot2AI → Send selected text…** in the selection's right-click menu. Plain-text inputs, textareas and editable page text are supported; password fields are excluded. Select up to 100,000 characters. If no text is selected, nothing is sent.

Text-only sending supports the web chat destinations. The current html2wp Mac app bridge requires an image; a text-only card explains this and lets you choose a web chat. Answers and follow-up chat stay in the same card. **Copy** copies the selected text; **Save** saves a UTF-8 `.txt` file. The **Copy only** destination includes the prompt too. Text cards remain in the capture stack alongside screenshots, and survive page reloads under the same retention rules.

## Use it

- Click the toolbar icon, then **Capture area**, or press **Alt+Shift+S** (⌥⇧S) on any page; see Keyboard shortcuts. Drag over the area; **Esc** cancels.
- A **preview card** appears in the corner of the page. The screenshot is already on the clipboard, so you can paste it anywhere with **⌘V** (**Ctrl+V** on Windows and Linux). From the card:
  - **Send to <your destination>**: one click. You can add a one-line message first; **Enter** sends, **Esc** closes the card. For html2wp the card shows "Sent to <project>", or the app's own reason with **Try again**. For ChatGPT, Claude and Perplexity it becomes the answer card (see Answer card). It hides by itself about 6 seconds after a successful send, but not while you hover over it or type in it, never while it shows an error, and never while it shows an answer.
  - **Annotate** opens the full editor. **Copy** copies the screenshot again. **Save** saves a copy (see Saving). The **chevron** lists the other destinations.
- In the editor: **A** arrow, **R** rectangle, **T** text, **H** highlight, **B** blur, **⌘Z** / **⇧⌘Z** undo and redo (Ctrl on Windows and Linux). Pick a colour and a stroke size in the toolbar. **Send** has the same destination menu as the card. **⌘Enter** sends.
- **Paste as input**: press ⌘V (or Ctrl+V) in the editor, the popup or the options page to open a pasted image, such as a macOS ⌘⇧4 screenshot, in the editor.

## Destinations

ChatGPT is the default until you choose another. Shot2AI offers three chats: **ChatGPT**, **Claude** and **Perplexity**. Choose one in the popup's list or in **Options**, turn on the others you use, or add any other web chat by name and address (for example an internal chat). The card's main button uses your default destination; its menu lists the known chats that are on, then html2wp, then your own chats.

Sending to a web chat attaches the screenshot through the chat's own file input (or pastes or drops it) and puts your message into its message box. For the four known chats it then sends the message itself (see Send automatically) while that chat's tab stays in the background. For chats you add, the chat's tab comes to the front and you press Enter there, unless you turn Send automatically on for it. If the screenshot does not arrive, nothing is typed or sent: it is on the clipboard, and the card says so.

**The chat's tab.** Sign in to the chat once, in its own tab, and keep that tab open. From then on Shot2AI uses that tab (the one it used last, or else the one of that site you used last), so each screenshot continues the same conversation; you never have to switch to it. To start a new conversation, tick **New chat** in the card's menu (the chevron): it applies to the next send only, and the button reads **Send to Claude (new chat)**. If there is no tab of that chat, or you closed it, Shot2AI opens one in the background, on your last conversation with that chat (or a new one). If the tab is on a page of the chat without a message box, such as its settings, Shot2AI takes it back to the conversation first.

**Signed out.** If the chat's tab shows a sign-in page, or the chat sends it to one (for example Google's), Shot2AI does nothing on that page: it never reads, fills in or clicks a sign-in form. The card says **Log in to <chat> once, then keep the tab open**, with **Open <chat> tab**; your screenshot waits in the card, and **Send again** sends it once you are signed in. Some chats take messages signed out but refuse images: if the chat answers the upload with a sign-in, a plan or a limit (for example "Upgrade to Pro"), the card says so in the chat's own words, and nothing is sent.

Chrome asks you once per site to let the extension use it. The extension holds no permission for any site until you allow it.

## Model

For ChatGPT, Claude and Perplexity you can choose the model. The popup has a **Model** list under **Captures go to**; its first entry, **Chat's current model**, is the default and switches nothing. The choice is kept per chat. The card's menu (the chevron) has the same list under **Model for this send**, for one send only, and the main button names the model: **Send to Claude · Opus 4.1**.

- **The list** is the chat's own: Shot2AI reads it from the model picker in the tab you keep open (it opens the picker, reads the names, closes it, and clicks nothing else), at most every 10 minutes when you open the popup, and whenever it switches a model. It keeps the list per chat. Until it has read one, the popup shows a few typical names, labelled **Typical names (may be out of date)**, and a line saying to keep that chat open. It never reads a tab you are looking at, or one that is answering. Perplexity offers a model choice with Perplexity Pro only, so it has no typical names.
- **Switching**: before attaching anything, Shot2AI opens the chat's model picker in its background tab, chooses the model (a name the chat shows; a short name such as "Opus" matches "Opus 4.1" when only one model fits, and looks in one "More models" submenu), and checks the chat now shows it. With **Chat's current model**, the picker is not touched at all.
- **If it cannot switch, nothing is sent**, and the card says why, in the chat's words when it has some: the model is not in the chat's list any more (the card lists what is), the name fits several models, the model needs another plan ("Claude: “Opus 4.1 is available on Max”"), the chat did not switch, or there is no picker (for Perplexity: choosing a model needs Perplexity Pro). The card offers **Send with current model** and **Open <chat> tab**. Shot2AI never changes the model without saying so.
- Each chat's picker is described in its own adapter (`src/sites/<chat>.js`, `model`), and the picker is driven by `src/picker.js`.

In **v0.5.1**, ChatGPT also has a separate **Thinking effort** choice in the popup and **Thinking effort for this send** in the card's menu. **Chat's current effort** is the default and leaves the slider alone. Minimum, Lower, Middle, Higher and Maximum select the nearest available step at 0%, 25%, 50%, 75% and 100% of the site's slider. These are slider positions, not fixed token budgets or claims about the model's own effort names. The bounds are read after selecting the model, so different models (including the 5.5 and 5.6 layouts) can have different ranges. The setting is checked again after reopening the panel; if it cannot be confirmed, no screenshot is attached or sent. **Send with current settings** bypasses both model and effort changes for that send.

The model menu can be inside the Thinking effort popover, with a combined label such as **5.5 Instant**. Reading the model list leaves the effort unchanged.

**v0.5.2** follows the intelligence picker verified in signed-in ChatGPT in Brave: it opens **Select model** before using the model radios, ignores inactive/inert views and response retry menus, and adjusts effort through the visible **Power** control. It supports both versioned composer labels and effort-only labels such as **Extra High**. Cached model lists are refreshed after an extension update, while saved choices remain. The browser fixtures cover this observed structure, including delayed updates, replaced controls, and ignored changes.

**v0.5.3** lets ChatGPT render its answer while its tab stays in the background. While the preview card waits for an answer, suspended animation frames get a temporary timer fallback. The active tab and page visibility stay unchanged. The helper is removed after completion, failure, cancellation or timeout, and expires automatically if its watcher disappears.

## Capture stack

Every capture in a tab stays in the card's corner as a stack of cards. The newest is on top, and older ones peek out behind it: up to five layers, then a **+N** badge. **‹ ›** (or **← →** when the card has focus) flip through them, with a counter such as **2 / 5**. Clicking a card behind brings it to the front. Each card keeps its own message and its own result, for example "Sent to Claude".

- **×** closes one capture. **Clear all** (in the card's menu) closes them all.
- **Send all captures** sends every unsent capture to your default destination:
  - A web chat gets them all pasted into one message.
  - html2wp gets up to 4 per message (html2wp 0.2.9 or later; older versions take one per message, and the card says so). The rest wait until the assistant finishes.
  - **Select captures** turns on a checkbox per card, for **Send selected captures**.
- After a send, the sent cards leave after a moment. The stack disappears when it is empty, never while you hover over it, and never while it still has unsent captures unless you close it.
- The stack belongs to the tab and survives navigating within it: it comes back when the new page loads, if Shot2AI may draw on that page. Otherwise the popup offers **Show N captures on this page**. **Esc** puts it away until your next capture.
- A tab keeps 20 captures at most; beyond that the oldest go, and the card says so.
- Area, visible page, full page, saved region, image and pasted-image captures all join the stack.

## Full-page capture

**Capture full page** is in the card's menu, the right-click menu and the floating toolbar, or press **Alt+Shift+F**. Shot2AI scrolls the page one screen at a time and joins the screens into one image, which opens in the card like any capture.

- **Scrolling:** a page that does not scroll itself but has a large scrolling panel (an app, a chat) scrolls that panel. Sticky and fixed headers and footers appear once: they are hidden after the first screen and put back afterwards, and so is your scroll position.
- **Progress** shows as **Capturing 3/8…** with **Cancel**; **Esc** cancels too.
- **Pages that never end** (infinite feeds) stop at the height set in **Options → Full-page capture** (5,000–50,000 px, default 20,000), after 30 screens, or when the page keeps growing at its bottom. The card says so: "Stopped at 20,000 px (the page keeps loading more)".
- **Very tall pages** would exceed the browser's 16,384 px image limit. Shot2AI scales the image down to fit, or, if it would have to go below half size, splits it into several images, and says which.


Tick destinations in the card's menu (the chevron next to Send), or in **Options → Send to several at once**, and choose **Send to all selected**. Each web chat gets its own tab and paste, one after another. html2wp gets the screenshot through the app at the same time. The card lists the result for each destination. The first time the set includes a web chat you have not sent to before, one notice names all such sites before anything goes.

## Prompts

Saved messages to send with a screenshot. Four come built in: **Fix this bug**, **Explain this**, **Match this design** and **What's wrong here?**. In **Options → Prompts** you can add, edit, delete and reorder prompts. The **first prompt is always the default**, marked **Default**. Move another prompt to the top to change it. It fills new captures, and a blank or whitespace-only message uses its current text when sent. Your own nonempty message takes precedence; deleting all prompts leaves no default. The card and the editor have a **Prompt** picker next to the message: picking one fills the message, and you can still edit it. Right-click → Shot2AI → **Send with prompt ▸** captures the visible page and sends it with that prompt.

## Send automatically

Each web chat in **Options → Other destinations** has a **Send automatically** switch. It is **on for ChatGPT, Claude and Perplexity** and off for chats you add. The first send to each chat says, in the card, that the message will be sent automatically without you reviewing it, and that some services restrict automated use in their terms. Turning it on for a chat you added shows that notice once in Options. After an update from 0.3 or older, where ChatGPT and Claude only pasted, the card shows the notice once more for each known chat.

With it on, Shot2AI does everything in the chat's tab while that tab stays in the background: it attaches the screenshot, types your message, waits until the chat has uploaded the image (its send button turns on), presses the send button, and checks that the message went (a stop button, your message in the thread, a new address, or an empty message box). The four known chats have known send buttons (see `src/sites/`). For any other chat Shot2AI looks for the nearest enabled submit button, or a button labelled Send, next to the message box, and presses nothing else. It is never used for html2wp, which has its own flow.

Nothing half-done is left unsaid. Each of these stops the send, and the card says so and offers **Open <chat> tab** so you can finish there:

- the chat is signed out (**Log in to <chat> once, then keep the tab open**, with **Send again**), or it refuses the image for a sign-in, a plan or a limit;
- the chat's message box is not there;
- the chat is still answering an earlier message (the card also offers **Try again**);
- the screenshot did not attach, or its upload failed (checked again just before Send, so a chat that drops the image never gets the text alone);
- the message did not go into the message box (the image is there, nothing is sent);
- the send button was not found ("press Enter there"), or Send was pressed but the message could not be seen going.

## Answer card

After a confirmed send to ChatGPT, Claude or Perplexity, the preview card on your page turns into an answer card. It shows **Sending to Claude…**, then **Claude is answering…** with the answer as it streams in, then **Claude answered**. The answer keeps its paragraphs, headings, lists, code blocks, tables and links; for Perplexity, the sources it lists come under the answer as links (http and https only, opening in a new tab). **Copy answer** copies it as Markdown, with the sources, **Continue in Claude** brings the Claude tab to the front, the **chat icon** opens a follow-up composer in the same card, and **Close** removes the card. Follow-ups keep the screenshot context in the same conversation; they send only the new text. **Enter** sends, **Shift+Enter** adds a line. The questions, answers and draft survive navigation in the source tab. Long answers scroll; drag the round grip at the card's top-left corner (or focus it and use the arrow keys) to make it wider or taller. An answer card never hides by itself; it comes back after you navigate within the tab until you close it.

- **Where the answer comes from**: while the answer is being written, the service worker reads the newest answer on the chat's page in its tab, the text as the page shows it, and passes it to the card. It uses no private APIs and reads no cookies or tokens. It reads only the message list of that chat page, and only until the answer is finished.
- **Safe to show**: the answer travels as a small tree of paragraphs, lists, code and links, not as the chat page's HTML, and the card builds it from text alone. Markup in an answer, such as `<script>`, shows as those characters; images, scripts, styles and event handlers are dropped, and only http and https links are kept.
- **When it ends**: the answer is finished when the chat's stop button has gone and the text has stopped changing. If nothing happens for 45 seconds (no stop button, no new text; for example a usage limit or a sign-in), or after 6 minutes in all, the card says **No answer from <chat> yet** and offers **Open <chat> tab**. If the chat's tab is closed, the card says so.
- A second screenshot continues that conversation in the same tab, and its own card shows the new answer: the answer read is what follows your newest message.

## Saved region

After capturing an area, choose **Region → Remember this region** in the card. The region is kept for that site as a share of the window, not in pixels. **Capture saved region** (in the card's Region menu, the right-click menu, or a shortcut you assign in Options) captures that part of the visible page again in one step. It is cut to the window if the window is now smaller. On a site without a saved region, it starts the area selection.

## Image format & quality

In **Options → Image format & quality**: **PNG** (lossless, the default), or **JPEG** or **WebP** at 50–100 %. It applies to screenshots sent to web chats and to saved copies (the file extension follows). html2wp always receives PNG, and a copy to the clipboard stays PNG, the only image type the clipboard accepts. The card shows the format and size, for example "JPEG 80 % · 64 KB".

## Floating toolbar (opt-in)

**Options → Floating toolbar** puts a small bar on every page with **Area**, **Visible**, **Region** and your destination. It is off by default. Switching it on asks Chrome for access to all sites, which it needs to appear on every page and capture from it; switching it off gives up that access. Drag it by its grip: its place is kept per site and it stays inside the window. Collapse it to a dot with **–**, or choose **⋯ → Hide on this site**; Options lists hidden sites with **Show again**. The bar steps aside while a capture is taken, so it is never in the screenshot. It appears on pages you open or reload after switching it on.

## Saving

Options → **Saving**:

- **Save a copy of every capture**: every capture is saved as soon as you select the area. The **Save** buttons in the card and the editor work whether or not this is on.
- **Folder**: choose any folder on your computer. If Chrome's access to it lapses, choose **Allow again**. Until you do, copies go to Downloads.
- **Downloads subfolder** (default `shot2ai/`): used when no folder is chosen, or when access to the chosen folder has lapsed.
- **File name**: a pattern with `{host}`, `{date}` and `{time}`. The default gives names like `shot2ai-example.com-2026-09-23-114512.png`.

## Privacy

- **html2wp**: the screenshot and the message go **only to 127.0.0.1**, the html2wp app on this computer. The app listens on 127.0.0.1 only, on port 47811 (or the next free one up to 47815). It answers only the paired extension: every request needs the pairing token, and a request from a web page's origin is refused. Once it has the screenshot, html2wp handles it like any image you attach in its chat.
- **A web chat** (ChatGPT, Claude, or one you added) **is a website**. A screenshot you send there goes to that site and is handled under its terms. The card and the editor say this the first time you send to each chat, and the Options page says it next to the destinations.
- **Send automatically** (on for ChatGPT and Claude) and **Send to all selected** send to web chats too: with Send automatically on, the message goes to that site without you reviewing it first.
- **The answer card** reads the chat's answer to your screenshot from that chat's page (the text it shows, and Perplexity's source links, nothing else) and shows it on the page you sent from. The answer is kept with the capture in the extension's storage until you close the card, a day at most, and goes nowhere else.
- **The model**: the model you chose for each known chat, and the names last read from its model picker, are kept in extension storage on this device.
- **The chat's tab and conversation**: while Chrome runs, Shot2AI remembers which tab it uses for each known chat (session storage, gone when Chrome quits). It keeps the address of your last conversation with each known chat on this device, so a closed tab opens again there. **Clear all captures and settings** removes it.
- **Sign-in pages** are never read, filled in or clicked: Shot2AI only notices that the chat shows one.
- The **floating toolbar** needs access to all sites while it is on. It reads nothing on those pages: it draws itself and captures only when you click it.
- Captures stay in the extension's own storage in this browser until you send, copy or save them. They are removed after sending to html2wp, or after a day.

## Develop

```
npm install
npm test
```

The tests run the unpacked extension in Chromium against a mock of the app's bridge (`tests/mock-bridge.mjs`, on a free 127.0.0.1 port), a mock web chat page on another port, and stand-ins for chatgpt.com, claude.ai, gemini.google.com and perplexity.ai (`tests/mock-ai.mjs`), each on its own site: a composer (ProseMirror-like, a Quill-like editor without a file input, or a textarea), a model picker (opening on pointerdown or on click, with locked models, an upgrade dialog, a submenu), an upload to the mock server, a send button that waits for it, a stop button, a streamed answer and, for Perplexity, sources; a sign-in page on another site. Gemini send scenarios are skipped while its preset is hidden; its standalone picker tests still run offline. The test copy points the adapters in `src/sites/` at the stand-ins, so the real sites are never loaded. The stand-ins are built to exercise Shot2AI's paths, not to copy the real pages. They cover:

- out of the box: ChatGPT is the default, the popup's list shows ChatGPT (and **Allow ChatGPT** when the site is not allowed), and there is no html2wp status
- the popup's destination list: the same destinations and order as Options, a change saved at once and followed by an open Options page (and the other way round), the focus ring, html2wp's status under it, and a declined site permission (the choice is kept, **Needs permission** and **Allow Claude** shown)
- auto-send to Claude and to ChatGPT: the chat's tab stays behind the owner's page, the chat gets the image, the message and one press of Send; the answer card goes from Sending to answering to answered, shows bold text, a list, a code block and a safe link, copies the answer as Markdown, resizes with the keyboard, never hides by itself, reads the new answer after a second send to the same tab, and **Continue in Claude** brings that tab to the front
- auto-send failures, with nothing sent and the message kept: a failed upload, no send button, a message box that refuses text, and a chat still answering (with **Try again**); each offers **Open Claude tab**
- an answer that never comes: **No answer from Claude yet** and **Open Claude tab**
- sanitisation: an answer with `<script>`, `onerror`, `onclick`, `onmouseover`, an `svg` with `onload`, an `iframe` and a `javascript:` link shows only inert text and the one https link
- Perplexity (a textarea, the answer and its sources, a `javascript:` source left out, sources in Copy answer)
- the chat's own tab: the owner's open tab is used and the conversation continues without a reload; **New chat** starts a new conversation in the same tab, for one send; a closed tab opens again, behind the page, on the last conversation
- signed out: a sign-in page is left alone (its email field untouched), the card asks to log in once, **Send again** works after signing in; a tab sent to a sign-in page on another site is reused, not doubled
- Perplexity refusing the upload for a plan ("Upgrade to Pro", in its words) or a sign-in, with its send button left on for the text alone: nothing is sent
- the model: the popup shows typical names until a chat's tab is open, then reads the list from its picker (opened once, closed, nothing chosen) and keeps it after the tab is closed; the choice is kept per chat
- sending with a chosen model switches it first and the chat gets the message with that model; the card's menu chooses another model for one send (the usual one stays); **Chat's current model** never opens the picker; each chat's picker switches, including Claude's "More models" submenu
- a model that cannot be had sends nothing and says why: not in the list (with the list), several matches, a disabled model with the site's words, an upgrade dialog with its words, a switch that did not take, no picker (Perplexity without Pro); **Send with current model** then sends with the chat's own model
- the right-click menu: its items and contexts, **Capture visible page**, **Send selection with a screenshot**, and **Send to ▸ Claude** changing the default. Playwright cannot open Chrome's context menu, so the test copy records the items the extension creates and calls the click handler directly. It also cannot check that a real menu click grants activeTab.
- switching the default to html2wp brings up html2wp's status, then pairing
- choosing ChatGPT, then a custom chat, as the default in Options
- a one-click send from the preview card: the mock receives the PNG at the right size and the message, and no editor opens
- the PNG on the clipboard after a capture
- auto-hide, which waits while the card is hovered and never runs after an error
- a busy chat's reason shown word for word, in both the card and the editor
- Annotate, then drawing and sending from the editor
- pasting an image into the editor with ⌘V or Ctrl+V
- a custom web chat receiving the pasted PNG file and the text
- a copy saved through the Downloads fallback, in JPEG at 80 % (the chat gets a JPEG too, html2wp still gets PNG)
- send to several at once: html2wp and a web chat from one click, with a result line for each
- auto-submit: on for ChatGPT and Claude and off for an added chat out of the box; off never presses the chat's send button, on presses it once while the chat's tab stays in the background, and a missing button is reported
- prompts: add, reorder, delete and a default prompt in Options; the picker in the card and the editor; Send with prompt from the right-click menu
- saved region: remembered per site, captured again at the same size, and clamped to the window
- keyboard shortcuts: the Options list from Chrome's bindings (and from a stubbed list with keys removed: **Not set**), **Change shortcuts** opening `chrome://extensions/shortcuts`, the keys in the popup and in the right-click menu titles. Real key presses cannot be automated, so the shortcuts themselves are not tested
- floating toolbar: off by default, registered when switched on, the Visible button, dragging (the place is kept after a reload), collapsing, hiding per site and showing again, and switching off

Screenshots go to `screenshots/`, or to the directory set by `SHOT2AI_SHOTS`. Live ChatGPT checks for version 0.5.2 and the deferred Claude test plan are recorded in `TESTING-0.5.2.md` in the source repository.

The test loads a copy of the extension with a few changes. Its manifest also holds `<all_urls>`, which stands in for the toolbar click that grants `activeTab`; Playwright cannot perform that click. The card's and the toolbar's shadow roots are opened so the test can reach inside them. The service worker records the context-menu items it creates and exposes its click handler. The shipped files have none of these changes. Chrome's own permission prompts (a chat site, all sites for the toolbar), the folder picker, keyboard shortcuts are not covered by this suite. Real chat pages are exercised separately through opt-in live tests. Each known chat has its own adapter in `src/sites/` (`chatgpt.js`, `claude.js`, `gemini.js`, `perplexity.js`): its message box, send and stop buttons, messages, answers, sign-in pages and, for Perplexity, sources. The automated suite checks these adapters against stand-ins; live checks are recorded separately. When a site changes, its adapter or the shared picker may need updating. Check them on the real sites, signed in, after a site changes.

To build the release ZIP (manifest.json, src, icons, licenses and README.md), run `python3 scripts/package.py`. It writes `dist/shot2ai-<version>.zip` and fails if any file referenced by the manifest, a page, a module import or an injected script is missing from the ZIP. `python3 scripts/icons.py` redraws the icons, and `python3 scripts/toolbar-preview.py` shows them on light and dark toolbars.

Version **0.5.7** reads Gemini’s current model menu, including `aria-haspopup="false"` items, and separates model names from Standard/High thinking. The extension no longer supplies outdated Gemini model names before reading the live menu. Background animation scheduling now also covers Gemini uploads and answers; its animation-only `aria-busy` state does not prevent completion. An obsolete saved model such as “Fast” must be replaced with a name from the live list or “Chat's current model”.

Version **0.5.6** clears an automatically prefilled prompt when the screenshot card's message field is clicked. User edits and prompts explicitly chosen from the menu stay intact, including after a page reload. An empty message still uses the current default when sent. Claude model lists now include the “More models” submenu, without confusing it with “Effort”. Claude effort uses its named Low, Medium, High, Extra and Max options; a missing or unconfirmed choice prevents sending.

Version **0.5.5** also fixes Claude attachment detection in its deeply nested composer and file pickers that list image extensions, as Perplexity does. An explicit upload limit or sign-in refusal stops further attachment attempts. Live checks and their limitations are recorded in `TESTING-0.5.5.md`; Perplexity's account-level document-analysis restriction still applies.

Every delivered extension change gets a new version. Keep `manifest.json`, `package.json` and the root entries in `package-lock.json` in sync; packaging checks this. The unpacked development build is linked at `~/Downloads/test/shot2ai`. Reload it in Chrome and check the version in the popup footer.

html2wp converts any website to WordPress: https://html2wp.dev/

## Keyboard shortcuts

In **v0.5.5**, typing in the screenshot card stays inside the extension, including on X.com, whose shortcuts also listen to `keypress` and `keyup`. Select all, copy, paste, undo and caret movement retain their native behavior. Area selection takes keyboard focus until it finishes or is cancelled; composition keys do not accidentally submit or close the card.

| Action | Default key |
|---|---|
| Capture area | Alt+Shift+S (⌥⇧S on a Mac) |
| Capture visible page | Alt+Shift+V (⌥⇧V) |
| Capture full page | Alt+Shift+F (⌥⇧F) |
| Capture saved region | Assign in Chrome’s shortcut settings |
| Send selected text (no image) | Alt+Shift+T (⌥⇧T) |
| Show this tab's captures | none; set one if you like |

Chrome allows four suggested shortcuts. Since v0.5.12, selected text takes the fourth default slot; saved-region capture remains available with a manually assigned shortcut. Chrome manages the keys. **Options → Keyboard shortcuts** lists the current ones (a key another extension already uses stays **Not set**), and **Change shortcuts** opens `chrome://extensions/shortcuts`, where you set them: an extension cannot set keys itself. The popup, the card's menu and the right-click menu show the current keys next to their actions. The right-click menu puts the key in the title, for example "Capture area…  (⌥⇧S)", because Chrome's context menus show no shortcuts of their own.

## Version

The popup footer, the editor's header, the right-click menu and **Options** show the version of Shot2AI that is loaded (for example **Shot2AI v0.4.0**). Options links **What's new** to that version's release notes.

## Legal

- `LICENSE`: proprietary, all rights reserved, © 2026 BELNEM s.r.o. Shot2AI is a product of BELNEM s.r.o., Beckovska 5, Bratislava, Slovakia (IČO 53713486).
- `THIRD-PARTY-NOTICES.md`: better-shot (BSD 3-Clause), the only third-party code.
- `PRIVACY.md`: the privacy policy, published at https://share.shot2ai.com/privacy (the page is `site/shot2ai/privacy/index.html`). Options → Privacy summarises it, links to it, and has **Clear all captures and settings**. Contact: hello@html2wp.dev.
- `STORE-LISTING.md`: the Chrome Web Store listing, the single-purpose statement and the permission justifications.

ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic. Gemini is a trademark of Google LLC. Perplexity is a trademark of Perplexity AI, Inc. Shot2AI is an independent product and is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic, Google or Perplexity AI.

## Credits

The editor's tools, colours, stroke sizes and arrow geometry follow [better-shot](https://github.com/iOSDevSK/better-shot) (BSD-3-Clause, © 2026 Kartik Labhshetwar), adapted from SwiftUI to a web canvas. Its licence is in `licenses/better-shot-LICENSE`.

Version **0.5.8** pulses background rendering from the extension during image attachment and submission, including sends without an answer watcher. This avoids depending only on a hidden page’s delayed timer to reveal the attachment preview. The helper is released after a send unless the answer watcher takes it over.

The retained Gemini live harness is paused while Gemini is hidden. For a future development test, re-enable its preset locally first. Then, for an opt-in Playwright test against signed-in Gemini, run `node tests/live-gemini.mjs`. Sign in manually in the dedicated browser. It captures a local test page through the popup and card, sends it to real Gemini, checks the returned answer without activating Gemini, waits six minutes in the background, and repeats in the same conversation. `SHOT2AI_LIVE_PROFILE` selects a dedicated test profile; `SHOT2AI_SHOTS` selects the report directory. The test keeps a JSON result, source screenshots and a Playwright trace after sign-in. Its test copy grants all-site capture permission and opens the card’s shadow root; the release does neither. The normal `npm test` suite uses local service stand-ins and does not consume chat quotas.

Version **0.5.9** uses Gemini’s image file input, created by opening Upload and tools, before trying paste/drop. It recognizes failed attachment chips and respects disabled Send components while files upload. A failed file already left in Gemini must be removed there before retrying; the extension explains this and does not duplicate or silently remove it. Live Gemini checks and service-side failures are distinguished in `TESTING-0.5.9.md`.

Version **0.5.10** adds **Chat in this card** to completed answers. Click the chat icon to ask a follow-up; Enter sends and Shift+Enter adds a line. Questions and answers stay in the same scrollable card, including after navigating or reloading the source page. Follow-ups use the original conversation without uploading the screenshot again, and leave existing chat drafts untouched.

Gemini is temporarily hidden from destination lists and menus. Its adapter and offline tests are retained for later verification, including with a paid account; this release does not establish whether a paid plan resolves the live-service failures. A saved Gemini default falls back to ChatGPT, and Gemini is excluded from multi-send. Saved Gemini preferences remain available for future reinstatement.

Version **0.5.11** renders the chat icon even when an older running worker omits it, refreshes icons on restored cards, and explains when a follow-up needs an extension reload. Answers saved before 0.5.10 can continue after verifying that their original tab still contains the same question and answer.


## Share a conversation (0.5.15)

The answer card keeps its top-right close button. Its bottom **Share** button (square with an upward arrow) opens **WhatsApp, Facebook, X, PDF, MD**. Every export includes the original screenshot (or selected text), all saved questions and answers, and source links. Unsent drafts and private chat URLs are omitted. If a captured answer was incomplete, the export says so.

- **PDF** opens a local preview and the browser print dialog: choose **Save as PDF**. Long conversations paginate and retain Unicode text.
- **MD** downloads one UTF-8 Markdown file, with the original PNG embedded as a data URL. Some Markdown readers block embedded images; use PDF for portable image display.
- **WhatsApp / Facebook / X** create a public link containing the original image and every saved exchange, then open the selected share composer with that link. WhatsApp attempts to open the native app; Chrome may ask permission, and WhatsApp Web is available as a fallback. Choose a recipient or audience and confirm sending in the selected service. No clipboard/paste step is required. Before the first public upload, complete the browser verification on `share.shot2ai.com`; authorization lasts 30 days. Links have a branded image preview. Public links expire after 30 days; **Settings → Privacy → Manage shared links** can delete them earlier. Clearing local data does not remove public copies.

Public conversation copies are hosted at **https://share.shot2ai.com** on Cloudflare Workers and private R2 storage. Each link is random and unlisted; anyone who receives it can read the copy. See [hosting and deployment](share-server/README.md).

Export snapshots expire after one hour and are removed on the next export access or by **Clear all captures and settings**. The local preview is a snapshot; later replies are included by opening Share again.

## Website buttons (0.5.14)

Enable **Settings → Website integrations** to use Shot2AI buttons on approved websites, including Agentmods. This optional feature shares the toolbar's optional all-site permission; disabling one feature keeps that permission while the other is enabled. It reads only explicit Shot2AI markers, and a click sends the approved prompt and page URL. See [the integration guide](integrations/README.md) to propose a URL + prompt by pull request and embed the assigned tag.

The popup keeps Capture area and the existing capture-stack control. Full-page capture, selected text, and website-integration setup are not extra popup buttons: use shortcuts/context menus for captures, and **Settings** for shortcut assignments and website integration setup. The model/effort option **Use selected … in chat** leaves the chat's own selection unchanged; it is not a model or effort name sent to the provider.
