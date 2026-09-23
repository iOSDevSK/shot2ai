# html2wp Screenshot (Chrome extension)

Report a problem in a conversion without leaving Chrome. Drag a rectangle over the part of the page that is wrong and send it, with a message, straight into the chat of the project you have open in the html2wp app. It takes one click from the preview card; you can open the editor first to add arrows, boxes, text, highlight or blur. You can also paste the screenshot into a web chat such as ChatGPT or Claude, or save a copy.

If the chat cannot take a message right now, for example while the assistant is still working, the extension shows the app's own reason and keeps your annotation. Choose **Try again** when the app is ready.

## Install

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Choose **Load unpacked** and select this folder (the one with `manifest.json`).
3. Pin **html2wp Screenshot** to the toolbar if you like.

## Pair with the app, once

1. In html2wp, open **Settings → Chrome extension**. It shows a 6-digit pairing code.
2. Click the extension's toolbar icon and enter the code.

Each code pairs one extension. After five wrong codes the code stops working; choose **New code** in Settings. **Unpair** in Settings revokes the extension.

## Use it

- Click the toolbar icon, then **Capture area**, or press **Alt+Shift+S** on any page. Drag over the area; **Esc** cancels.
- A **preview card** appears in the corner of the page. The screenshot is already on the clipboard, so you can paste it anywhere with **⌘V** (**Ctrl+V** on Windows and Linux). From the card:
  - **Send to html2wp**: one click. You can add a one-line message first; **Enter** sends, **Esc** closes the card. The card shows "Sent to <project>", or the app's own reason with **Try again**. It hides by itself about 6 seconds after a successful send, but not while you hover over it or type in it, and never while it shows an error.
  - **Annotate** opens the full editor. **Copy** copies the screenshot again. **Save** saves a copy (see Saving). The **chevron** lists the other destinations.
- In the editor: **A** arrow, **R** rectangle, **T** text, **H** highlight, **B** blur, **⌘Z** / **⇧⌘Z** undo and redo (Ctrl on Windows and Linux). Pick a colour and a stroke size in the toolbar. **Send** has the same destination menu as the card. **⌘Enter** sends.
- **Paste as input**: press ⌘V (or Ctrl+V) in the editor, the popup or the options page to open a pasted image, such as a macOS ⌘⇧4 screenshot, in the editor.

## Destinations

html2wp is always the first destination and the default. In **Options** you can also turn on **ChatGPT** and **Claude**, or add any other web chat by name and address (for example Gemini, or an internal chat). The destination you used last becomes the card's main button; html2wp stays first in the list.

Sending to a web chat finds an open tab of that chat, or opens it. The extension then pastes the screenshot and your message into the chat's message box. **It never submits**: you check the message and press Enter in the chat yourself. If pasting does not work on that site, the screenshot and message are already on the clipboard; the card says "Copied. Paste with ⌘V in <chat>".

Chrome asks you once per site to let the extension use it. The extension holds no permission for any site until you allow it.

## Saving

Options → **Saving**:

- **Save a copy of every capture**: every capture is saved as soon as you select the area. The **Save** buttons in the card and the editor work whether or not this is on.
- **Folder**: choose any folder on your computer. If Chrome's access to it lapses, choose **Allow again**. Until you do, copies go to Downloads.
- **Downloads subfolder** (default `html2wp-shots/`): used when no folder is chosen, or when access to the chosen folder has lapsed.
- **File name**: a pattern with `{host}`, `{date}` and `{time}`. The default gives names like `html2wp-example.com-2026-09-23-114512.png`.

## Privacy

- **html2wp** (the default): the screenshot and the message go **only to 127.0.0.1**, the html2wp app on this computer. The app listens on 127.0.0.1 only, on port 47811 (or the next free one up to 47815). It answers only the paired extension: every request needs the pairing token, and a request from a web page's origin is refused. Once it has the screenshot, html2wp handles it like any image you attach in its chat.
- **A web chat** (ChatGPT, Claude, or one you added) **is a website**. A screenshot you send there goes to that site and is handled under its terms. The card and the editor say this the first time you send to each chat, and the Options page says it next to the destinations.
- Captures stay in the extension's own storage in this browser until you send, copy or save them. They are removed after sending to html2wp, or after a day.

## Develop

```
npm install
npm test
```

The tests run the unpacked extension in Chromium against a mock of the app's bridge (`tests/mock-bridge.mjs`, on 127.0.0.1:47811) and a mock web chat page on another port. They cover:

- pairing
- a one-click send from the preview card: the mock receives the PNG at the right size and the message, and no editor opens
- the PNG on the clipboard after a capture
- auto-hide, which waits while the card is hovered and never runs after an error
- a busy chat's reason shown word for word, in both the card and the editor
- Annotate, then drawing and sending from the editor
- pasting an image into the editor with ⌘V or Ctrl+V
- a custom web chat receiving the pasted PNG file and the text
- a copy saved through the Downloads fallback

Screenshots go to `screenshots/`.

The test loads a copy of the extension with two changes. Its manifest also holds `<all_urls>`, which stands in for the toolbar click that grants `activeTab`; Playwright cannot perform that click. The card's shadow root is opened so the test can reach inside it. The shipped files have neither change. Chrome's own "allow this site" prompt, and the folder picker, cannot be driven by Playwright and are not covered.

## Credits

The editor's tools, colours, stroke sizes and arrow geometry follow [better-shot](https://github.com/iOSDevSK/better-shot) (BSD-3-Clause, © 2026 Kartik Labhshetwar), adapted from SwiftUI to a web canvas. Its licence is in `licenses/better-shot-LICENSE`.
