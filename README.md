# html2wp Screenshot (Chrome extension)

Report a problem in a conversion without leaving Chrome. Drag a rectangle over the part of the page that is wrong. Mark it up with arrows, boxes, text, highlight or blur, then add a message. The extension sends the screenshot and the message straight into the chat of the project you have open in the html2wp app.

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

- Click the toolbar icon, then **Capture area**, or press **Alt+Shift+S** on any page.
- Drag over the area. **Esc** cancels.
- In the editor: **A** arrow, **R** rectangle, **T** text, **H** highlight, **B** blur, **⌘Z** / **⇧⌘Z** undo and redo. Pick a colour and a stroke size in the toolbar. **Copy** and **Download** keep a copy for yourself.
- Write what is wrong and choose **Send to html2wp** (or **⌘Enter**). The message appears in the chat of the open project, like a message you typed with an image attached, and html2wp comes to the front.

## Privacy

The screenshot and the message go **only to 127.0.0.1**, the html2wp app on this computer. The extension has no other host permission and sends nothing anywhere else. Between the capture and the editor, the screenshot is kept in the extension's own storage in this browser and removed after it is sent (or after a day).

The app listens on 127.0.0.1 only, on port 47811 (or the next free one up to 47815). It answers only the paired extension: every request needs the pairing token, and a request from a web page's origin is refused. Once it has the screenshot, html2wp handles it like any image you attach in its chat.

## Develop

```
npm install
npm test
```

The test runs the unpacked extension in Chromium against a mock of the app's bridge (`tests/mock-bridge.mjs`, on 127.0.0.1:47811). It pairs, selects an area of a test page, draws, and sends. It checks the PNG size and text the mock receives, and that a busy chat shows the app's reason. It saves screenshots to `screenshots/`. The test loads a copy of the extension whose manifest also holds `<all_urls>`. This stands in for the toolbar click that grants `activeTab`, which Playwright cannot perform. The shipped manifest does not include it.

## Credits

The editor's tools, colours, stroke sizes and arrow geometry follow [better-shot](https://github.com/iOSDevSK/better-shot) (BSD-3-Clause, © 2026 Kartik Labhshetwar), adapted from SwiftUI to a web canvas. Its licence is in `licenses/better-shot-LICENSE`.
