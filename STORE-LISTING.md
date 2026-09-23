# Chrome Web Store listing: Shot2AI

## Name

Shot2AI — Screenshot, Annotate & Send to AI

## Short description (manifest description, 132 characters at most)

Capture any part of a page, mark it up and send it in one click to your AI chat (ChatGPT, Claude, …) or the html2wp app.

## Category

Tools

## Language

English

## Full description

Shot2AI turns "look at this" into one click. Drag over the part of the page you mean, and the screenshot is ready to send, with a short note, to the AI chat you work with, or to the html2wp app on your Mac.

What you can do:

• Capture an area, the visible page, a whole scrolling page, or an image on the page. Or paste a screenshot you already took.
• A small preview card appears in the corner. Send in one click, add a message, or pick a saved prompt such as "Fix this bug" or "Match this design".
• Open the editor to add arrows, boxes, text and highlights, or blur anything private.
• Send to your default destination, or to several at once. Web chats get the screenshot pasted into their message box; you press Enter. Automatic sending is available if you switch it on.
• Keep captures of a session as a stack, flip through them, and send them together.
• Remember a region of a page and capture it again with one shortcut.
• Save copies as PNG, JPEG or WebP to a folder you choose.
• Use the right-click menu, keyboard shortcuts, or an optional floating toolbar.

Private by design: Shot2AI has no server, no account, no analytics and no tracking. Screenshots go only where you send them: the html2wp app on your own computer, or the chat website you chose.

ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic. Shot2AI is an independent product and is not affiliated with, endorsed by or sponsored by OpenAI or Anthropic.

## Single purpose

Shot2AI captures screenshots of web pages at the user's request, lets the user annotate them, and sends them where the user chooses: a web chat, the html2wp desktop app on the same computer, the clipboard or a file.

## Permission justifications

| Permission | Why Shot2AI needs it |
|---|---|
| `activeTab` | Capture the tab the user is on when they click the toolbar button, use the shortcut or the right-click menu, and show the selection overlay and preview card on that tab. |
| `storage` | Keep the user's settings, destinations, saved prompts, saved regions and the html2wp pairing token on their device. |
| `scripting` | Draw the area-selection overlay, the preview card and the optional floating toolbar on the page, and paste the screenshot into the chat site the user chose. |
| `downloads` | Save a copy of a screenshot to the Downloads folder when the user saves or has "Save a copy" switched on. |
| `clipboardWrite` | Put the screenshot on the clipboard so the user can paste it anywhere, and as a fallback when pasting into a chat is not possible. |
| `contextMenus` | Offer Shot2AI's capture and send actions in the right-click menu. |
| Host permission `http://127.0.0.1/*` | Talk to the html2wp desktop app, which listens only on the user's own computer. |
| Optional host permissions `https://*/*`, `http://*/*` | Asked for one site at a time, when the user adds or chooses a web chat (for example chatgpt.com), so the screenshot can be pasted into that site's message box. Nothing is asked for until the user picks a chat. |
| Optional host permission `<all_urls>` | Asked for only when the user switches on the floating toolbar, which appears on every page and captures from it. Switching the toolbar off gives this permission up. |
| Remote code | None. All code is in the package. |

## Data usage disclosures (matching PRIVACY.md)

- **Website content**: yes. Screenshots of pages, and text the user selected, when the user asks. They are handled on the device and sent only to the destination the user chooses.
- **Web history**: the address and title of a captured page are kept with that capture on the device, to label it and name saved files. They are not collected or sent anywhere else.
- **Personally identifiable information, health, financial, authentication, personal communications, location, user activity**: not collected. The html2wp pairing token stays on the device.

Certifications:
- The developer does not sell or transfer user data to third parties, except to the destination the user chooses (the approved use case).
- The developer does not use or transfer user data for purposes unrelated to the item's single purpose.
- The developer does not use or transfer user data to determine creditworthiness or for lending purposes.

Privacy policy: PRIVACY.md (to be hosted at a public URL before submission).
