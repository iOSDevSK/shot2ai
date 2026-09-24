# Chrome Web Store listing: Shot2AI

## Developer / publisher

BELNEM s.r.o., Beckovska 5, Bratislava, Slovakia (IČO 53713486), hello@html2wp.dev

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
• Pick where screenshots go right in the toolbar popup: ChatGPT, Claude, Gemini, Perplexity, the html2wp app, your own chats, copy or save.
• Send to ChatGPT, Claude, Gemini or Perplexity without leaving your page. Sign in to the chat once and keep its tab open: Shot2AI attaches the screenshot and your message there, sends it while that tab stays in the background, continues the same conversation (or starts a new chat when you ask), and shows the answer in the card on your page, with Perplexity's sources. Copy the answer, or continue in the chat. If anything stops the send (you are signed out, the chat refuses the image, the upload failed, the chat is still busy), the card says so and nothing half-done goes out. You can turn automatic sending off per chat.
• Send to several destinations at once. Chats you add get the screenshot pasted into their message box; you press Enter, or switch automatic sending on for them.
• Keep captures of a session as a stack, flip through them, and send them together.
• Remember a region of a page and capture it again with one shortcut.
• Save copies as PNG, JPEG or WebP to a folder you choose.
• Use the right-click menu, keyboard shortcuts, or an optional floating toolbar.

Private by design: Shot2AI has no server, no account, no analytics and no tracking. Screenshots go only where you send them: the html2wp app on your own computer, or the chat website you chose. The chat's answer is read from that chat's page and shown only to you.

ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic. Gemini is a trademark of Google LLC. Perplexity is a trademark of Perplexity AI, Inc. Shot2AI is an independent product and is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic, Google or Perplexity AI.

## Single purpose

Shot2AI captures screenshots of web pages at the user's request, lets the user annotate them, and sends them where the user chooses: a web chat, the html2wp desktop app on the same computer, the clipboard or a file. For ChatGPT, Claude, Gemini and Perplexity it shows the chat's answer to the screenshot next to the page it came from.

## Permission justifications

| Permission | Why Shot2AI needs it |
|---|---|
| `activeTab` | Capture the tab the user is on when they click the toolbar button, use the shortcut or the right-click menu, and show the selection overlay and preview card on that tab. |
| `storage` | Keep the user's settings, destinations, saved prompts, saved regions and the html2wp pairing token on their device. |
| `scripting` | Draw the area-selection overlay, the preview card and the optional floating toolbar on the page; attach the screenshot and the message in the chat site the user chose and, when sending automatically, press its send button; for ChatGPT, Claude, Gemini and Perplexity, read the chat's answer to that message (and Perplexity's source links) on the chat's page to show it in the card, and notice a sign-in page there without touching it. |
| `downloads` | Save a copy of a screenshot to the Downloads folder when the user saves or has "Save a copy" switched on. |
| `clipboardWrite` | Put the screenshot on the clipboard so the user can paste it anywhere, and as a fallback when pasting into a chat is not possible. |
| `contextMenus` | Offer Shot2AI's capture and send actions in the right-click menu. |
| Host permission `http://127.0.0.1/*` | Talk to the html2wp desktop app, which listens only on the user's own computer. |
| Optional host permissions `https://*/*`, `http://*/*` | Asked for one site at a time, when the user adds or chooses a web chat (for example chatgpt.com, claude.ai, gemini.google.com or www.perplexity.ai, in the popup's list or in Options), so the screenshot can be attached in that site's message box and sent, and, for those four, so the chat's answer can be read from that site's page and shown in the card. Nothing is asked for until the user picks a chat. |
| Optional host permission `<all_urls>` | Asked for only when the user switches on the floating toolbar, which appears on every page and captures from it. Switching the toolbar off gives this permission up. |
| Remote code | None. All code is in the package. |

## Data usage disclosures (matching PRIVACY.md)

- **Website content**: yes. Screenshots of pages, and text the user selected, when the user asks. They are handled on the device and sent only to the destination the user chooses. After Shot2AI sends a screenshot to ChatGPT or Claude for the user, it reads that chat's answer from the chat's page (the text it shows) and shows it in the card; the answer stays on the device with the capture (deleted when the card is closed, a day at most) and is not sent anywhere.
- **Web history**: the address and title of a captured page are kept with that capture on the device, to label it and name saved files. The address of the user's last conversation with each of ChatGPT, Claude, Gemini and Perplexity is kept on the device so a closed chat tab opens again there. None of it is collected or sent anywhere else.
- **Personal communications**: the AI chat's answer to a screenshot the user sent to ChatGPT, Claude, Gemini or Perplexity is read from that chat's page to show it in the card. It stays on the device and is not transmitted anywhere; no other messages or conversations are read. Declare it under website content / personal communications as the form asks, marked as not sold, not transferred and used only for the single purpose.
- **Personally identifiable information, health, financial, authentication, location, user activity**: not collected. The html2wp pairing token stays on the device.

Certifications:
- The developer does not sell or transfer user data to third parties, except to the destination the user chooses (the approved use case).
- The developer does not use or transfer user data for purposes unrelated to the item's single purpose.
- The developer does not use or transfer user data to determine creditworthiness or for lending purposes.

Privacy policy: https://html2wp.dev/shot2ai/privacy (the same text as PRIVACY.md; the page is `site/shot2ai/privacy/index.html`).

Developer contact: hello@html2wp.dev
