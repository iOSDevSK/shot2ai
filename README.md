# Shot2AI — Screenshot, Annotate & Send to AI

Shot2AI is a Chrome extension for sending screenshots to AI. Its main job is reporting a problem in an html2wp conversion without leaving Chrome. Drag a rectangle over the part of the page that is wrong and send it, with a message, straight into the chat of the project you have open in the html2wp app. It takes one click from the preview card; you can open the editor first to add arrows, boxes, text, highlight or blur. You can also send the screenshot to a web chat such as ChatGPT or Claude, whose answer then appears in the card on your page, or save a copy.

If the chat cannot take a message right now, for example while the assistant is still working, the extension shows the app's own reason and keeps your annotation. Choose **Try again** when the app is ready.

## Install

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Choose **Load unpacked** and select this folder (the one with `manifest.json`).
3. Pin **Shot2AI** to the toolbar if you like.

## Where screenshots go

Out of the box the default destination is **ChatGPT**. The popup's **Screenshots go to** list shows it and changes it on the spot: ChatGPT, Claude, html2wp (Mac app), your own chats, Copy only or Save only, in the same order as **Options → Default destination**, and the two stay in step. Choosing a web chat there asks Chrome for that one site straight away; if you decline, the choice stays and the popup shows **Needs permission** with an **Allow <chat>** button. The card's main button reads **Send to <default>** (or **Copy** / **Save**). Other chats you turn on stay in the card's menu (the chevron), which sends one screenshot elsewhere without changing the default.

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
- **Send selection with a screenshot** (on selected text) captures the visible page and puts the selected text in the message.
- **Options**.

A click on the menu gives Shot2AI access to that tab for the capture, as the toolbar button does.

## Pair with html2wp, once (only if you use html2wp)

1. In html2wp, open **Settings → Chrome extension**. It shows a 6-digit pairing code.
2. Click the Shot2AI toolbar icon and enter the code. You can also enter it in Shot2AI's Options.

Each code pairs one extension. After five wrong codes the code stops working; choose **New code** in Settings. **Unpair** in Settings revokes the extension.

## Use it

- Click the toolbar icon, then **Capture area**, or press **Alt+Shift+S** (⌥⇧S) on any page; see Keyboard shortcuts. Drag over the area; **Esc** cancels.
- A **preview card** appears in the corner of the page. The screenshot is already on the clipboard, so you can paste it anywhere with **⌘V** (**Ctrl+V** on Windows and Linux). From the card:
  - **Send to <your destination>**: one click. You can add a one-line message first; **Enter** sends, **Esc** closes the card. For html2wp the card shows "Sent to <project>", or the app's own reason with **Try again**. For ChatGPT and Claude it becomes the answer card (see Answer card). It hides by itself about 6 seconds after a successful send, but not while you hover over it or type in it, never while it shows an error, and never while it shows an answer.
  - **Annotate** opens the full editor. **Copy** copies the screenshot again. **Save** saves a copy (see Saving). The **chevron** lists the other destinations.
- In the editor: **A** arrow, **R** rectangle, **T** text, **H** highlight, **B** blur, **⌘Z** / **⇧⌘Z** undo and redo (Ctrl on Windows and Linux). Pick a colour and a stroke size in the toolbar. **Send** has the same destination menu as the card. **⌘Enter** sends.
- **Paste as input**: press ⌘V (or Ctrl+V) in the editor, the popup or the options page to open a pasted image, such as a macOS ⌘⇧4 screenshot, in the editor.

## Destinations

ChatGPT is the default until you choose another. In **Options** you can also turn on **ChatGPT** and **Claude**, or add any other web chat by name and address (for example Gemini, or an internal chat). The card's main button uses your default destination; its menu lists ChatGPT and Claude when they are on, then html2wp, then your own chats.

Sending to a web chat finds an open tab of that chat, or opens it. The extension attaches the screenshot through the chat's own file input and puts your message into its message box. For ChatGPT and Claude it then sends the message itself (see Send automatically) while that tab stays in the background. For chats you add, the chat's tab comes to the front and you press Enter there, unless you turn Send automatically on for it. If the screenshot does not arrive, nothing is typed or sent: it is on the clipboard, and the card says "Copied. Paste with ⌘V in <chat>".

Chrome asks you once per site to let the extension use it. The extension holds no permission for any site until you allow it.

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

**Capture full page** is in the popup, the card's menu, the right-click menu and the floating toolbar, or press **Alt+Shift+F**. Shot2AI scrolls the page one screen at a time and joins the screens into one image, which opens in the card like any capture.

- **Scrolling:** a page that does not scroll itself but has a large scrolling panel (an app, a chat) scrolls that panel. Sticky and fixed headers and footers appear once: they are hidden after the first screen and put back afterwards, and so is your scroll position.
- **Progress** shows as **Capturing 3/8…** with **Cancel**; **Esc** cancels too.
- **Pages that never end** (infinite feeds) stop at the height set in **Options → Full-page capture** (5,000–50,000 px, default 20,000), after 30 screens, or when the page keeps growing at its bottom. The card says so: "Stopped at 20,000 px (the page keeps loading more)".
- **Very tall pages** would exceed the browser's 16,384 px image limit. Shot2AI scales the image down to fit, or, if it would have to go below half size, splits it into several images, and says which.


Tick destinations in the card's menu (the chevron next to Send), or in **Options → Send to several at once**, and choose **Send to all selected**. Each web chat gets its own tab and paste, one after another. html2wp gets the screenshot through the app at the same time. The card lists the result for each destination. The first time the set includes a web chat you have not sent to before, one notice names all such sites before anything goes.

## Prompts

Saved messages to send with a screenshot. Four come built in: **Fix this bug**, **Explain this**, **Match this design** and **What's wrong here?**. In **Options → Prompts** you can add, edit, delete and reorder prompts and choose a **default prompt**, which fills the message of every new capture. The card and the editor have a **Prompt** picker next to the message: picking one fills the message, and you can still edit it. Right-click → Shot2AI → **Send with prompt ▸** captures the visible page and sends it with that prompt.

## Send automatically

Each web chat in **Options → Other destinations** has a **Send automatically** switch. It is **on for ChatGPT and Claude** and off for chats you add. The first send to each chat says, in the card, that the message will be sent automatically without you reviewing it, and that some services restrict automated use in their terms. Turning it on for a chat you added shows that notice once in Options. After an update from 0.3 or older, where ChatGPT and Claude only pasted, the card shows the notice once more for each of them.

With it on, Shot2AI does everything in the chat's tab while that tab stays in the background: it attaches the screenshot, types your message, waits until the chat has uploaded the image (its send button turns on), presses the send button, and checks that the message went (a stop button, your message in the thread, a new address, or an empty message box). ChatGPT and Claude have known send buttons. For any other chat Shot2AI looks for the nearest enabled submit button, or a button labelled Send, next to the message box, and presses nothing else. It is never used for html2wp, which has its own flow.

Nothing half-done is left unsaid. Each of these stops the send, and the card says so and offers **Open <chat> tab** so you can finish there:

- the chat's message box is not there (for example, you are signed out);
- the chat is still answering an earlier message (the card also offers **Try again**);
- the screenshot did not attach, or its upload failed;
- the message did not go into the message box (the image is there, nothing is sent);
- the send button was not found ("press Enter there"), or Send was pressed but the message could not be seen going.

## Answer card

After a confirmed send to ChatGPT or Claude, the preview card on your page turns into an answer card. It shows **Sending to Claude…**, then **Claude is answering…** with the answer as it streams in, then **Claude answered**. The answer keeps its paragraphs, headings, lists, code blocks, tables and links. **Copy answer** copies it as Markdown, **Continue in Claude** brings the Claude tab to the front, and **Close** removes the card. Long answers scroll; drag the round grip at the card's top-left corner (or focus it and use the arrow keys) to make it wider or taller. An answer card never hides by itself; it comes back after you navigate within the tab until you close it.

- **Where the answer comes from**: while the answer is being written, the service worker reads the newest answer on the chat's page in its tab, the text as the page shows it, and passes it to the card. It uses no private APIs and reads no cookies or tokens. It reads only the message list of that chat page, and only until the answer is finished.
- **Safe to show**: the answer travels as a small tree of paragraphs, lists, code and links, not as the chat page's HTML, and the card builds it from text alone. Markup in an answer, such as `<script>`, shows as those characters; images, scripts, styles and event handlers are dropped, and only http and https links are kept.
- **When it ends**: the answer is finished when the chat's stop button has gone and the text has stopped changing. If nothing happens for 45 seconds (no stop button, no new text; for example a usage limit or a sign-in), or after 6 minutes in all, the card says **No answer from <chat> yet** and offers **Open <chat> tab**. If the chat's tab is closed, the card says so.
- A second screenshot sent to the same chat tab continues that conversation, and its own card shows the new answer.

## Saved region

After capturing an area, choose **Region → Remember this region** in the card. The region is kept for that site as a share of the window, not in pixels. **Capture saved region** (in the card's Region menu, the right-click menu, or **Alt+Shift+R**) captures that part of the visible page again in one step. It is cut to the window if the window is now smaller. On a site without a saved region, it starts the area selection.

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
- **The answer card** reads the chat's answer to your screenshot from that chat's page (the text it shows, nothing else) and shows it on the page you sent from. The answer is kept with the capture in the extension's storage until you close the card, a day at most, and goes nowhere else.
- The **floating toolbar** needs access to all sites while it is on. It reads nothing on those pages: it draws itself and captures only when you click it.
- Captures stay in the extension's own storage in this browser until you send, copy or save them. They are removed after sending to html2wp, or after a day.

## Develop

```
npm install
npm test
```

The tests run the unpacked extension in Chromium against a mock of the app's bridge (`tests/mock-bridge.mjs`, on a free 127.0.0.1 port), a mock web chat page on another port, and stand-ins for chatgpt.com and claude.ai (`tests/mock-ai.mjs`): a ProseMirror-like composer, an upload to the mock server, a send button that waits for it, a stop button and a streamed answer. The test copy points the ChatGPT and Claude presets at the stand-ins, so the real sites are never loaded. They cover:

- out of the box: ChatGPT is the default, the popup's list shows ChatGPT (and **Allow ChatGPT** when the site is not allowed), and there is no html2wp status
- the popup's destination list: the same destinations and order as Options, a change saved at once and followed by an open Options page (and the other way round), the focus ring, html2wp's status under it, and a declined site permission (the choice is kept, **Needs permission** and **Allow Claude** shown)
- auto-send to Claude and to ChatGPT: the chat's tab stays behind the owner's page, the chat gets the image, the message and one press of Send; the answer card goes from Sending to answering to answered, shows bold text, a list, a code block and a safe link, copies the answer as Markdown, resizes with the keyboard, never hides by itself, reads the new answer after a second send to the same tab, and **Continue in Claude** brings that tab to the front
- auto-send failures, with nothing sent and the message kept: a failed upload, no send button, a message box that refuses text, and a chat still answering (with **Try again**); each offers **Open Claude tab**
- an answer that never comes: **No answer from Claude yet** and **Open Claude tab**
- sanitisation: an answer with `<script>`, `onerror`, `onclick`, `onmouseover`, an `svg` with `onload`, an `iframe` and a `javascript:` link shows only inert text and the one https link
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

Screenshots go to `screenshots/`.

The test loads a copy of the extension with a few changes. Its manifest also holds `<all_urls>`, which stands in for the toolbar click that grants `activeTab`; Playwright cannot perform that click. The card's and the toolbar's shadow roots are opened so the test can reach inside them. The service worker records the context-menu items it creates and exposes its click handler. The shipped files have none of these changes. Chrome's own permission prompts (a chat site, all sites for the toolbar), the folder picker, keyboard shortcuts and real ChatGPT and Claude pages cannot be driven by Playwright and are not covered. The ChatGPT and Claude selectors in `src/settings.js` (message box, send and stop buttons, messages and answers) follow those sites' pages and are checked against the stand-ins only; check them on the real sites after a site changes.

To build the release ZIP (manifest.json, src, icons, licenses and README.md), run `python3 scripts/package.py`. It writes `dist/shot2ai-<version>.zip` and fails if any file referenced by the manifest, a page, a module import or an injected script is missing from the ZIP. `python3 scripts/icons.py` redraws the icons, and `python3 scripts/toolbar-preview.py` shows them on light and dark toolbars.

html2wp converts any website to WordPress: https://html2wp.dev/

## Keyboard shortcuts

| Action | Default key |
|---|---|
| Capture area | Alt+Shift+S (⌥⇧S on a Mac) |
| Capture visible page | Alt+Shift+V (⌥⇧V) |
| Capture full page | Alt+Shift+F (⌥⇧F) |
| Capture saved region | Alt+Shift+R (⌥⇧R) |
| Show this tab's captures | none; set one if you like |

Chrome manages the keys. **Options → Keyboard shortcuts** lists the current ones (a key another extension already uses stays **Not set**), and **Change shortcuts** opens `chrome://extensions/shortcuts`, where you set them: an extension cannot set keys itself. The popup, the card's menu and the right-click menu show the current keys next to their actions. The right-click menu puts the key in the title, for example "Capture area…  (⌥⇧S)", because Chrome's context menus show no shortcuts of their own.

## Version

The popup footer, the editor's header, the right-click menu and **Options** show the version of Shot2AI that is loaded (for example **Shot2AI v0.4.0**). Options links **What's new** to that version's release notes.

## Legal

- `LICENSE`: proprietary, all rights reserved, © 2026 BELNEM s.r.o. Shot2AI is a product of BELNEM s.r.o., Beckovska 5, Bratislava, Slovakia (IČO 53713486).
- `THIRD-PARTY-NOTICES.md`: better-shot (BSD 3-Clause), the only third-party code.
- `PRIVACY.md`: the privacy policy, published at https://html2wp.dev/shot2ai/privacy (the page is `site/shot2ai/privacy/index.html`). Options → Privacy summarises it, links to it, and has **Clear all captures and settings**. Contact: hello@html2wp.dev.
- `STORE-LISTING.md`: the Chrome Web Store listing, the single-purpose statement and the permission justifications.

ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic. Shot2AI is an independent product and is not affiliated with, endorsed by or sponsored by OpenAI or Anthropic.

## Credits

The editor's tools, colours, stroke sizes and arrow geometry follow [better-shot](https://github.com/iOSDevSK/better-shot) (BSD-3-Clause, © 2026 Kartik Labhshetwar), adapted from SwiftUI to a web canvas. Its licence is in `licenses/better-shot-LICENSE`.
