# Shot2AI — Screenshot, Annotate & Send to AI

Shot2AI is a Chrome extension that sends screenshots or selected text to ChatGPT, Claude, Perplexity, a custom web chat, or the html2wp Mac app. Read the answer and ask follow-up questions in a card on the page you are viewing.

## Install or update

1. Download **shot2ai-0.5.22.zip** from the [latest release](https://github.com/iOSDevSK/shot2ai/releases/latest).
2. Extract the ZIP to a folder you will keep on your computer.
3. Open `chrome://extensions` and enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Pin Shot2AI to Chrome's toolbar if you like.

To update an existing unpacked installation, replace its files with the new release and click **Reload** on its card in `chrome://extensions`. Reload open source pages if they still show an older Shot2AI card. The popup footer shows the loaded version.

You can also clone this repository and load its root folder directly. No build step or npm installation is needed.

## Capture and send

- **Capture area**: drag a rectangle over any part of the page.
- **Capture visible page**: capture the current viewport from the right-click menu or a shortcut.
- **Capture full page**: capture a long page, subject to browser size limits.
- **Saved region**: reuse a rectangle on the same website.
- **Selected text**: open a text-only card with your selection and prompt; no image is attached.

The preview card lets you choose a saved prompt, write a message, annotate, copy, save or send the capture. Multiple captures stay in a stack with a separate message for each. An automatically filled prompt clears when you click its message field; your own edits are preserved. Sending an empty field uses the first saved prompt.

Click **Annotate** to add arrows, boxes, text, highlights or blur. Click **Use in card** (or press Ctrl+Enter / ⌘Enter) to apply the annotations and return to the original preview card. Its prompt, model and effort remain selected; send the edited image and continue chatting there. The editor has no separate send panel. You can also paste an image into the editor; a standalone editor without an original card supports Copy and Save. Choose PNG or JPEG and a save location in Settings. Chat destinations receive the selected image format; the html2wp bridge uses PNG.

## Destinations, models and effort

**ChatGPT** is the default destination. Change it in the popup or Settings. Chrome asks for access to each chat site when needed. Sign in to the service yourself, then keep its tab open; Shot2AI reuses that conversation. **New chat** starts another conversation for the next send. If several tabs of the same chat service are open, including in different windows, the popup warns you and the capture card asks which tab to use before sending. Follow-up questions stay in the chosen conversation. Other send methods require a single target tab.

For supported interfaces, select a model and thinking effort in Shot2AI. Available models are read from your chat's menu, including ChatGPT's nested model list behind its thinking effort control. **Use selected model in chat** and **Use selected effort in chat** preserve the chat's current settings. Old saved **Instant** choices migrate to the current model with minimum effort once the new ChatGPT model list is detected; an explicit effort choice is preserved. If a requested setting cannot be confirmed, Shot2AI keeps the capture and explains the problem before sending.

**Send automatically** is enabled for the built-in chat destinations. With it disabled, Shot2AI prepares the message in the chat tab for you to send. A custom web chat can be added in Settings; its interface must support image attachment and a message composer.

Gemini is temporarily hidden from destination menus. Its adapter remains in the extension for future reactivation.

AI services control model access, subscriptions and usage limits. Their web interfaces can change independently of Shot2AI.

### html2wp Mac app

In the [html2wp app](https://html2wp.dev/), open Settings → Chrome extension and enter its six-digit pairing code in Shot2AI. A capture and its message go to the chat of the open conversion project through the app's local bridge. If that chat is busy, the card keeps your work and offers a retry. Text-only sends currently require a web chat destination.

## Continue the conversation in the card

After a supported chat answers, its response appears in the capture card, including formatting and source links. Click the **chat icon** to ask a follow-up in the same conversation. Enter sends; Shift+Enter adds a line. The screenshot is not uploaded again for each follow-up.

If the chat has an unsent draft, Shot2AI asks before replacing it. **Clear draft and send** removes its text, images and files, verifies the composer is empty, then sends the new capture or follow-up. Without confirmation, the draft stays untouched. If removal fails or the conversation changes, sending stops.

Questions and answers stay in the same scrollable card. **Copy answer** copies the response as Markdown; **Continue in ChatGPT / Claude / Perplexity** opens the original conversation. The top-right **×** closes the card.

## Share or export

The **Share** button, a square with an upward arrow, offers **WhatsApp, Facebook, X, PDF, MD and Link**. Exports include the screenshot or selected text, all saved questions and answers, and source links. Unsent drafts and private chat URLs are excluded.

- **WhatsApp / Facebook / X**: create a public conversation link with a preview image, then open the selected service's share composer. Choose the recipient or audience and confirm sending there. WhatsApp attempts to open its native app, with a web fallback.
- **Link**: create the same public conversation link without opening a social app. The menu expands upward and shows the URL with **Copy** beneath the icons. Opening the Share menu alone does not publish anything.
- **PDF**: open a local preview and choose **Save as PDF** in the browser's print dialog. The document uses A4 page margins and additional inner spacing to keep text clear of the edges.
- **MD**: download a Markdown file with the image embedded as a data URL. Some Markdown readers block embedded images; PDF is the more portable option for image display.

Public links use **https://share.shot2ai.com**. Complete browser verification before the first public upload. Links expire after 30 days; delete a copy earlier in **Settings → Privacy → Manage shared links**. Anyone with a link can read it. Clearing local extension data does not delete public copies, and deletion cannot remove copies recipients have already saved.

## Keyboard shortcuts and settings

| Action | Default shortcut | Mac |
|---|---|---|
| Capture area | Alt+Shift+S | ⌥⇧S |
| Capture visible page | Alt+Shift+V | ⌥⇧V |
| Capture full page | Alt+Shift+F | ⌥⇧F |
| Send selected text | Alt+Shift+T | ⌥⇧T |
| Capture saved region | Assign in Chrome | Assign in Chrome |
| Show this tab's captures | Assign in Chrome | Assign in Chrome |

Use **Settings → Keyboard shortcuts → Change shortcuts** to open `chrome://extensions/shortcuts`. Chrome controls assignments; a conflicting shortcut may be unset. Typing and editing shortcuts inside Shot2AI cards stay separate from the underlying website's shortcuts, including on X.

Settings also contains saved prompts, destination preferences, optional floating toolbar and website buttons, image/save settings, and privacy controls. The popup keeps the main capture action and access to existing captures.

## Website buttons

Enable **Settings → Website integrations** to use Shot2AI buttons on approved sites such as Agentmods. This feature shares optional site access with the floating toolbar. Clicking a button sends the registered prompt and target URL; the website cannot supply an arbitrary prompt.

The approved registry is [src/integration-registry.json](src/integration-registry.json), which is both bundled with the extension and read from this repository for updates. See the [website integration guide](integrations/README.md) for registration and an installation link for visitors who do not have Shot2AI.

## Privacy and permissions

- Captures and conversations stay in extension storage until you send, export or share them. The extension removes local captures after a day at most; Settings provides **Clear all captures and settings**.
- Sending to a web chat shares the image/text and prompt with that provider under its terms. The first-use notice identifies this destination.
- The html2wp bridge communicates with the paired app on `127.0.0.1` using a pairing token.
- Public sharing uploads a copy to Cloudflare Workers and private R2 storage. Verification, upload quotas and rate limits protect that service. Public URLs grant read access; deletion requires a separate capability retained by the extension.
- Website integrations fetch a reviewed configuration registry from GitHub. They do not download executable extension code.
- Optional floating-toolbar and website-button features require broader site access; enable them only when you want them.

Read the [privacy policy](PRIVACY.md) or its [hosted copy](https://share.shot2ai.com/privacy). Contact: hello@html2wp.dev.

## Repository contents

This repository tracks the files distributed in the extension: `manifest.json`, `src/`, `icons/`, `licenses/`, this README, the integration guide, licence and privacy notices. `.gitignore` is the only repository-only metadata file.

Development scripts, tests, test reports, screenshots, dependency manifests, website hosting files and the sharing server are maintained outside Git tracking. They are not required to load the unpacked extension. Public sharing connects to the existing hosted service.

Version **0.5.22** migrates stale ChatGPT Instant selections and adds explicit **Clear draft and send** confirmation for unsent text, images and attachments, including in-card follow-ups.

## Licence and credits

Shot2AI is a product of **BELNEM s.r.o.** See [LICENSE](LICENSE), [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and [licenses/better-shot-LICENSE](licenses/better-shot-LICENSE). The editor's tools and arrow geometry are adapted from [better-shot](https://github.com/iOSDevSK/better-shot), under BSD-3-Clause.

ChatGPT, Claude, Gemini and Perplexity are trademarks of their respective owners. Shot2AI is independent and is not affiliated with or endorsed by those providers.
