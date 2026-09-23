# Shot2AI: AI screenshot extension for ChatGPT, Claude & html2wp

Shot2AI is a Chrome extension for sending screenshots to AI. Its main job is reporting a problem in an html2wp conversion without leaving Chrome. Drag a rectangle over the part of the page that is wrong and send it, with a message, straight into the chat of the project you have open in the html2wp app. It takes one click from the preview card; you can open the editor first to add arrows, boxes, text, highlight or blur. You can also paste the screenshot into a web chat such as ChatGPT or Claude, or save a copy.

If the chat cannot take a message right now, for example while the assistant is still working, the extension shows the app's own reason and keeps your annotation. Choose **Try again** when the app is ready.

## Install

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Choose **Load unpacked** and select this folder (the one with `manifest.json`).
3. Pin **Shot2AI** to the toolbar if you like.

## Where screenshots go

Out of the box the default destination is **ChatGPT**. The popup shows it, and until chatgpt.com is allowed it offers an **Allow ChatGPT** button. Chrome asks for that one site on the click. Change the default in **Options → Default destination**: ChatGPT (default), Claude, html2wp (Mac app), your own chats, Copy only or Save only. The card's main button reads **Send to <default>** (or **Copy** / **Save**). Other chats you turn on stay in the card's menu.

The html2wp status (running, pairing, open project, chat ready) appears only when html2wp is the default. It also appears when you pick html2wp in the card's menu: the card then says whether the app is running, paired and ready.

## Right-click menu

Right-click any page, selection, image or link and choose **Shot2AI**:

- **Capture area…** starts the area selection.
- **Capture visible page** takes the whole visible part of the page straight to the preview card.
- **Send to ▸** lists your destinations with a mark on the default. Picking one makes it the default for the next capture.
- **Capture and send to <default>** captures the visible page and sends it at once. The card only shows the result; the first send to a web chat still asks you to confirm once.
- **Send this image to <default>** (on an image) takes the image itself, or cuts it out of a capture of the page when the site does not allow reading it, and opens the card.
- **Send selection with a screenshot** (on selected text) captures the visible page and puts the selected text in the message.
- **Options**.

A click on the menu gives Shot2AI access to that tab for the capture, as the toolbar button does.

## Pair with html2wp, once (only if you use html2wp)

1. In html2wp, open **Settings → Chrome extension**. It shows a 6-digit pairing code.
2. Click the Shot2AI toolbar icon and enter the code. You can also enter it in Shot2AI's Options.

Each code pairs one extension. After five wrong codes the code stops working; choose **New code** in Settings. **Unpair** in Settings revokes the extension.

## Use it

- Click the toolbar icon, then **Capture area**, or press **Alt+Shift+S** on any page. Drag over the area; **Esc** cancels.
- A **preview card** appears in the corner of the page. The screenshot is already on the clipboard, so you can paste it anywhere with **⌘V** (**Ctrl+V** on Windows and Linux). From the card:
  - **Send to <your destination>**: one click. You can add a one-line message first; **Enter** sends, **Esc** closes the card. For html2wp the card shows "Sent to <project>", or the app's own reason with **Try again**; for a web chat it says the screenshot was pasted in and you press Enter there. It hides by itself about 6 seconds after a successful send, but not while you hover over it or type in it, and never while it shows an error.
  - **Annotate** opens the full editor. **Copy** copies the screenshot again. **Save** saves a copy (see Saving). The **chevron** lists the other destinations.
- In the editor: **A** arrow, **R** rectangle, **T** text, **H** highlight, **B** blur, **⌘Z** / **⇧⌘Z** undo and redo (Ctrl on Windows and Linux). Pick a colour and a stroke size in the toolbar. **Send** has the same destination menu as the card. **⌘Enter** sends.
- **Paste as input**: press ⌘V (or Ctrl+V) in the editor, the popup or the options page to open a pasted image, such as a macOS ⌘⇧4 screenshot, in the editor.

## Destinations

ChatGPT is the default until you choose another. In **Options** you can also turn on **ChatGPT** and **Claude**, or add any other web chat by name and address (for example Gemini, or an internal chat). The card's main button uses your default destination; its menu lists ChatGPT and Claude when they are on, then html2wp, then your own chats.

Sending to a web chat finds an open tab of that chat, or opens it. The extension then pastes the screenshot and your message into the chat's message box. **It never submits**: you check the message and press Enter in the chat yourself. If pasting does not work on that site, the screenshot and message are already on the clipboard; the card says "Copied. Paste with ⌘V in <chat>".

Chrome asks you once per site to let the extension use it. The extension holds no permission for any site until you allow it.

## Saving

Options → **Saving**:

- **Save a copy of every capture**: every capture is saved as soon as you select the area. The **Save** buttons in the card and the editor work whether or not this is on.
- **Folder**: choose any folder on your computer. If Chrome's access to it lapses, choose **Allow again**. Until you do, copies go to Downloads.
- **Downloads subfolder** (default `shot2ai/`): used when no folder is chosen, or when access to the chosen folder has lapsed.
- **File name**: a pattern with `{host}`, `{date}` and `{time}`. The default gives names like `shot2ai-example.com-2026-09-23-114512.png`.

## Privacy

- **html2wp**: the screenshot and the message go **only to 127.0.0.1**, the html2wp app on this computer. The app listens on 127.0.0.1 only, on port 47811 (or the next free one up to 47815). It answers only the paired extension: every request needs the pairing token, and a request from a web page's origin is refused. Once it has the screenshot, html2wp handles it like any image you attach in its chat.
- **A web chat** (ChatGPT, Claude, or one you added) **is a website**. A screenshot you send there goes to that site and is handled under its terms. The card and the editor say this the first time you send to each chat, and the Options page says it next to the destinations.
- Captures stay in the extension's own storage in this browser until you send, copy or save them. They are removed after sending to html2wp, or after a day.

## Develop

```
npm install
npm test
```

The tests run the unpacked extension in Chromium against a mock of the app's bridge (`tests/mock-bridge.mjs`, on 127.0.0.1:47811) and a mock web chat page on another port. They cover:

- out of the box: ChatGPT is the default, the popup shows ChatGPT (and **Allow ChatGPT** when the site is not allowed), and there is no html2wp status
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
- a copy saved through the Downloads fallback

Screenshots go to `screenshots/`.

The test loads a copy of the extension with three changes. Its manifest also holds `<all_urls>`, which stands in for the toolbar click that grants `activeTab`; Playwright cannot perform that click. The card's shadow root is opened so the test can reach inside it. The service worker records the context-menu items it creates and exposes its click handler. The shipped files have none of these changes. Chrome's own "allow this site" prompt, and the folder picker, cannot be driven by Playwright and are not covered.

To build the release ZIP (manifest.json, src, icons, licenses and README.md), run `python3 scripts/package.py`. It writes `dist/shot2ai-<version>.zip` and fails if any file referenced by the manifest, a page, a module import or an injected script is missing from the ZIP. `python3 scripts/icons.py` redraws the icons, and `python3 scripts/toolbar-preview.py` shows them on light and dark toolbars.

html2wp converts any website to WordPress: https://html2wp.dev/

## Credits

The editor's tools, colours, stroke sizes and arrow geometry follow [better-shot](https://github.com/iOSDevSK/better-shot) (BSD-3-Clause, © 2026 Kartik Labhshetwar), adapted from SwiftUI to a web canvas. Its licence is in `licenses/better-shot-LICENSE`.
