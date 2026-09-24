# Shot2AI privacy policy

Last updated: 24 September 2026

This policy is published at https://html2wp.dev/shot2ai/privacy.

Shot2AI is a Chrome extension by BELNEM s.r.o. that captures part of a web page, lets you mark it up and sends it where you choose. This policy explains what it handles and where that goes.

## What Shot2AI captures

- **Screenshots** of the page you are on, and only when you ask for one: the toolbar button, the keyboard shortcut, the right-click menu, the floating toolbar or the preview card. This includes an area you select, the visible page, a full page, a saved region, or an image on the page.
- **The message you type** to go with a screenshot, and the prompts you save.
- **Text you have selected**, when you choose "Send selection with a screenshot".
- The **address and title** of the page a screenshot comes from. They are used to label the screenshot and to name saved files.
- **The AI chat's answer** to a screenshot Shot2AI sent for you to ChatGPT, Claude, Gemini or Perplexity. After the message has gone, Shot2AI reads the answer that follows it on that chat's page, in its tab (the text the page shows, and for Perplexity the source links it lists), and shows it in the card on the page you sent from. It reads nothing else on the chat's page: no other messages or conversations, no cookies, no sign-in data, and no private APIs.
- **Whether the chat shows a sign-in page**, or refuses the image with a message (such as a plan or a limit), so the card can tell you. Shot2AI never reads what is typed into, fills in or clicks anything on a sign-in page.

Shot2AI reads nothing else from the pages you visit.

## Where it goes

There is **no Shot2AI server**. Shot2AI never sends anything to its developer or to any service of its own.

A screenshot and its message go only where you send them:

- **html2wp** (the Mac app): only to the app on your own computer, at 127.0.0.1. Nothing leaves your computer this way.
- **A web chat you choose** (for example ChatGPT, Claude, or a chat you add): to that website, in its tab, under that site's own terms and privacy policy. Chrome asks for your permission for each site first, and Shot2AI tells you the first time you send to it. With **Send automatically** on (on for ChatGPT, Claude, Gemini and Perplexity, off for chats you add; you can change it in Options), Shot2AI also presses that site's send button for you, so the message goes without you reviewing it.
- **The chat's answer** stays in your browser: Shot2AI shows it in the card and sends it nowhere.
- **Copy** puts the screenshot on your clipboard. **Save** writes a file to a folder you choose or to your Downloads folder.

## What is stored, and where

Everything is stored locally in your browser:

- **Settings, prompts and destinations** are in Chrome's extension storage (`chrome.storage.local`).
- **Captures** waiting in the preview card (the capture stack) or the editor are in the extension's IndexedDB. They are deleted when you send, close or clear them, when their tab is closed, and at the latest a day later.
- **The model you chose** for each of ChatGPT, Claude, Gemini and Perplexity, and **the model names** last read from that chat's model picker, are kept in extension storage, so the popup and the card can offer them. Reading the list opens the chat's model picker in its tab and closes it again; Shot2AI clicks nothing else there.
- **The address of your last conversation** with each of ChatGPT, Claude, Gemini and Perplexity is kept in extension storage, so a closed chat tab opens again on it. While Chrome runs, Shot2AI also remembers which tab it uses for each of them (session storage, cleared when Chrome quits).
- **A chat's answer** is kept with its capture in the same IndexedDB, so the answer card can come back after you navigate within the tab. It is deleted when you close that card, when its tab is closed, and at the latest a day later.
- **The pairing token for html2wp** is in extension storage.
- **The folder you chose for saving** is stored as a folder handle in IndexedDB. Shot2AI can write only to that folder.

You can delete all of it at any time: **Options → Privacy → Clear all captures and settings**. Removing the extension also deletes it.

## What Shot2AI does not do

- No analytics, no tracking, no advertising, no telemetry.
- No sale or transfer of your data to anyone.
- No use of your data for any purpose other than the one you asked for (capturing and sending a screenshot, and showing the chat's answer to it).
- No remote code: everything Shot2AI runs is inside the extension.

## Permissions

Shot2AI asks for the permissions it needs to do the above: capturing the current tab when you ask, storing settings, saving files, copying to the clipboard, the right-click menu, and access to the chat sites you choose (to send the screenshot there and, for ChatGPT, Claude, Gemini and Perplexity, to read the answer to it). The floating toolbar, when you switch it on, needs access to all sites so it can appear on every page. Shot2AI's Chrome Web Store listing explains each permission.

## Chrome Web Store Limited Use

The use of information received from Chrome APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements. Shot2AI uses the data it handles only to provide its single purpose: capturing, annotating and sending screenshots where you choose, and showing the chat's answer to them. It does not transfer that data to third parties except to the destination you choose, does not use it for advertising, and does not let people read it except as needed for that purpose, for security, or to comply with law.

## Trademarks

ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic. Gemini is a trademark of Google LLC. Perplexity is a trademark of Perplexity AI, Inc. Shot2AI is an independent product and is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic, Google or Perplexity AI.

## Who is responsible, and contact

Shot2AI is made and published by BELNEM s.r.o., Beckovska 5, Bratislava, Slovakia (IČO 53713486), which is responsible for this policy. Contact: hello@html2wp.dev
