# Shot2AI privacy policy

Last updated: 24 September 2026

This policy is published at https://share.shot2ai.com/privacy.

Shot2AI is a Chrome extension by BELNEM s.r.o. that captures part of a web page, lets you mark it up and sends it where you choose. This policy explains what it handles and where that goes.

## What Shot2AI captures

- **Screenshots** of the page you are on, and only when you ask for one: the toolbar button, the keyboard shortcut, the right-click menu, the floating toolbar or the preview card. This includes an area you select, the visible page, a full page, a saved region, or an image on the page.
- **The message you type** to go with a screenshot, and the prompts you save.
- **Text you have selected**, when you use “Send selected text” from its shortcut, popup or context menu, or choose “Send selection with a screenshot”. The text-only action reads only your explicit selection and attaches your prompt, without capturing an image. It excludes password fields.
- The **address and title** of the page a screenshot comes from. They are used to label the screenshot and to name saved files.
- **The AI chat's answer** to a screenshot or follow-up message Shot2AI sent for you to ChatGPT, Claude or Perplexity. After the message has gone, Shot2AI reads the answer that follows it on that chat's page, in its tab (the text the page shows, and for Perplexity the source links it lists), and shows it in the card on the page you sent from. It reads nothing else on the chat's page: no other messages or conversations, no cookies, no sign-in data, and no private APIs.
- **Whether the chat shows a sign-in page**, or refuses the image with a message (such as a plan or a limit), so the card can tell you. Shot2AI never reads what is typed into, fills in or clicks anything on a sign-in page.

When Website integrations is enabled, Shot2AI also looks for explicit data-shot2ai buttons and their target URLs. It reads no other page content for this feature.

## Where it goes

Normal capture and chat use do not upload conversations to a Shot2AI server. Choosing **WhatsApp, Facebook or X** in the Share menu explicitly uploads a public copy of the selected conversation to the Shot2AI sharing service at **share.shot2ai.com**, hosted on Cloudflare Workers and private R2 storage. When optional Website integrations is enabled and a tagged button is encountered, it fetches a public URL-and-prompt registry from raw.githubusercontent.com/iOSDevSK/shot2ai, with a 15-minute local cache. GitHub receives the normal network request (including your IP), but no captures, prompts from your conversations, or page URLs are sent with that registry request.

A screenshot or selected text and its prompt go only where you send them:

- **html2wp** (the Mac app): only to the app on your own computer, at 127.0.0.1. Nothing leaves your computer this way.
- **A web chat you choose** (for example ChatGPT, Claude, or a chat you add): to that website, in its tab, under that site's own terms and privacy policy. Chrome asks for your permission for each site first, and Shot2AI tells you the first time you send to it. With **Send automatically** on (on for ChatGPT, Claude and Perplexity, off for chats you add; you can change it in Options), Shot2AI also presses that site's send button for you, so the message goes without you reviewing it.
- **The chat's answer** stays in your browser unless you export or share it. PDF and Markdown are generated locally. Choosing WhatsApp, Facebook or X uploads the original screenshot (or selected text), source URL, all saved questions and answers, and source links to the Shot2AI sharing service. It opens the selected social app with the public URL; you choose the recipient and confirm sending there. Anyone with the URL can read the copy. The copy expires after 30 days and can be deleted earlier from **Options → Privacy → Manage shared links**. Unsent drafts and internal AI chat URLs are not uploaded.
- **Copy** puts the screenshot on your clipboard. **Save** writes a file to a folder you choose or to your Downloads folder. For text-only cards, Copy puts text on the clipboard and Save writes a UTF-8 text file.

## What is stored, and where

Captures and settings are stored locally. Copies you explicitly publish through social sharing are also stored on the sharing server:

- **Sharing verification** uses Cloudflare Turnstile on `share.shot2ai.com` before the first upload and when the 30-day authorization expires. Cloudflare processes browser/network signals for bot protection. No screenshot or conversation is sent during verification. A signed upload credential is stored in Chrome extension storage; it is not a Cloudflare account credential.
- **Public shared copies** are stored with lossless compression, include a generated social preview image and expire after 30 days. Expired URLs stop serving immediately. The service schedules hourly cleanup of expired records in batches, with a 30-day R2 lifecycle rule as an additional deletion mechanism. The service uses temporary hourly hashes of connection IPs for upload throttling and a keyed hash for the per-IP storage quota. The keyed hash is retained with the quota index until the corresponding copy is removed; raw IP addresses are not stored in that index. Your browser stores the public link and its deletion token; the token is never included in the public link or page. Social services and recipients may save their own copies that Shot2AI cannot delete.
- **Export snapshots** include only the selected capture and its saved exchanges, omit unsent drafts and private chat URLs, and expire after one hour. Expired snapshots are removed on the next export access, or with Clear all. Exported files and clipboard contents are controlled by you and are not removed by clearing the extension.
- **The approved website registry** is cached locally for offline use. Website integrations is off until you enable it.
- **Settings, prompts and destinations** are in Chrome's extension storage (`chrome.storage.local`).
- **Captures**, including selected text, waiting in the preview card (the capture stack) or the editor are in the extension's IndexedDB. They are deleted when you send, close or clear them, when their tab is closed, and at the latest a day later.
- **The model you chose** for each of ChatGPT, Claude and Perplexity, and **the model names** last read from that chat's model picker, are kept in extension storage, so the popup and the card can offer them. Reading the list opens the chat's model picker in its tab and closes it again; Shot2AI clicks nothing else there.
- **The address of your last conversation** with each of ChatGPT, Claude and Perplexity is kept in extension storage, so a closed chat tab opens again on it. While Chrome runs, Shot2AI also remembers which tab it uses for each of them (session storage, cleared when Chrome quits).
- **A chat's answer** is kept with its capture in the same IndexedDB, so the answer card can come back after you navigate within the tab. It is deleted when you close that card, when its tab is closed, and at the latest a day later.
- **The pairing token for html2wp** is in extension storage.
- **The folder you chose for saving** is stored as a folder handle in IndexedDB. Shot2AI can write only to that folder.

You can delete local data at any time: **Options → Privacy → Clear all captures and settings**. Removing the extension also deletes local data. Delete public copies through **Manage shared links** before clearing or uninstalling if you want them removed early: clearing local data removes deletion tokens, but does not revoke public links. Those links otherwise expire after 30 days.

## What Shot2AI does not do

- No analytics, no tracking, no advertising, no telemetry.
- No sale of your data. Transfers happen only for the chat or sharing action you request.
- No use of your data for any purpose other than the one you asked for (capturing and sending a screenshot, and showing the chat's answer to it).
- No remotely hosted extension code: everything the extension runs is packaged with it. The separate sharing verification website loads Cloudflare Turnstile.

## Permissions

Shot2AI asks for the permissions it needs to do the above: capturing the current tab when you ask, storing settings, saving files, copying to the clipboard, the right-click menu, and access to the chat sites you choose (to send the screenshot there and, for ChatGPT, Claude and Perplexity, to read the answer to it). The floating toolbar and Website integrations, when you switch them on, request optional access to all sites so their controls can appear on pages. Website buttons are activated only within the registry-approved origin/path, and only a real click sends the registered prompt and URL. Shot2AI's Chrome Web Store listing explains each permission.

## Chrome Web Store Limited Use

The use of information received from Chrome APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements. Shot2AI uses the data it handles only to provide its single purpose: capturing, annotating and sending screenshots where you choose, and showing the chat's answer to them. It does not transfer that data to third parties except to the destination you choose, does not use it for advertising, and does not let people read it except as needed for that purpose, for security, or to comply with law.

## Trademarks

ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic. Gemini is a trademark of Google LLC. Perplexity is a trademark of Perplexity AI, Inc. Shot2AI is an independent product and is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic, Google or Perplexity AI.

## Who is responsible, and contact

Shot2AI is made and published by BELNEM s.r.o., Beckovska 5, Bratislava, Slovakia (IČO 53713486), which is responsible for this policy. Contact: hello@html2wp.dev

Follow-up chat in the answer card sends your new text to the same conversation, without re-uploading the screenshot. The card keeps the questions, answers, conversation address and unsent follow-up draft with the capture on this device, under the same retention and deletion rules as the capture. Gemini is temporarily hidden from the available destinations; its existing preferences are preserved locally for possible future reinstatement.
