# Shot2AI privacy policy

Last updated: 23 September 2026

Shot2AI is a Chrome extension that captures part of a web page, lets you mark it up and sends it where you choose. This policy explains what it handles and where that goes.

## What Shot2AI captures

- **Screenshots** of the page you are on, and only when you ask for one: the toolbar button, the keyboard shortcut, the right-click menu, the floating toolbar or the preview card. This includes an area you select, the visible page, a full page, a saved region, or an image on the page.
- **The message you type** to go with a screenshot, and the prompts you save.
- **Text you have selected**, when you choose "Send selection with a screenshot".
- The **address and title** of the page a screenshot comes from. They are used to label the screenshot and to name saved files.

Shot2AI reads nothing else from the pages you visit.

## Where it goes

There is **no Shot2AI server**. Shot2AI never sends anything to its developer or to any service of its own.

A screenshot and its message go only where you send them:

- **html2wp** (the Mac app): only to the app on your own computer, at 127.0.0.1. Nothing leaves your computer this way.
- **A web chat you choose** (for example ChatGPT, Claude, or a chat you add): to that website, in its tab, under that site's own terms and privacy policy. Chrome asks for your permission for each site first, and Shot2AI tells you the first time you send to it. With **Send automatically** on (off by default), Shot2AI also presses that site's send button for you.
- **Copy** puts the screenshot on your clipboard. **Save** writes a file to a folder you choose or to your Downloads folder.

## What is stored, and where

Everything is stored locally in your browser:

- **Settings, prompts and destinations** are in Chrome's extension storage (`chrome.storage.local`).
- **Captures** waiting in the preview card or the editor are in the extension's IndexedDB. Captures older than a day are deleted when a new one is saved.
- **The pairing token for html2wp** is in extension storage.
- **The folder you chose for saving** is stored as a folder handle in IndexedDB. Shot2AI can write only to that folder.

You can delete all of it at any time: **Options → Privacy → Clear all captures and settings**. Removing the extension also deletes it.

## What Shot2AI does not do

- No analytics, no tracking, no advertising, no telemetry.
- No sale or transfer of your data to anyone.
- No use of your data for any purpose other than the one you asked for (capturing and sending a screenshot).
- No remote code: everything Shot2AI runs is inside the extension.

## Permissions

Shot2AI asks for the permissions it needs to do the above: capturing the current tab when you ask, storing settings, saving files, copying to the clipboard, the right-click menu, and access to the chat sites you choose. The floating toolbar, when you switch it on, needs access to all sites so it can appear on every page. `STORE-LISTING.md` explains each permission.

## Chrome Web Store Limited Use

The use of information received from Chrome APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements. Shot2AI uses the data it handles only to provide its single purpose: capturing, annotating and sending screenshots where you choose. It does not transfer that data to third parties except to the destination you choose, does not use it for advertising, and does not let people read it except as needed for that purpose, for security, or to comply with law.

## Trademarks

ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic. Shot2AI is an independent product and is not affiliated with, endorsed by or sponsored by OpenAI or Anthropic.

## Contact

Filip Dvoran, CONTACT-EMAIL (the developer contact address, to be filled in before publishing)
