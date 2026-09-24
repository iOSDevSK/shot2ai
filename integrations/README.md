# Add a Shot2AI button to a website

A registration contains only a public HTTPS URL (optionally a path prefix) and a prompt. The website provides a tag and the target page's URL; the extension gets the prompt from the reviewed registry, never from page JavaScript.

## Submit and approve

1. Propose a public HTTPS URL and a prompt in a pull request or issue in this repository. A path prefix may limit the integration to part of a site.
2. After review, the maintainer adds the entry to [`src/integration-registry.json`](../src/integration-registry.json). Each entry contains `url`, `prompt` and `tag`. The URL must be canonical, with a trailing slash and no credentials, query or fragment.
3. The stable tag is `s2ai-` followed by the first 16 lowercase hexadecimal characters of the SHA-256 hash of the canonical URL. Editing the prompt does not change the tag. The maintainer supplies the tag after approving the registration.
4. Merge the approved registry change into `main`, then embed that tag on the website. A proposed tag is not active until its entry is published.

The registry is distributed with the extension and fetched from the same `src/integration-registry.json` path on GitHub. There is no GitHub Actions tag-generation workflow in this distribution-only repository; maintainers prepare and validate registrations with their local tooling.

The extension checks the public registry at most once every 15 minutes when a tagged button is encountered. Offline it uses the last valid list, or the bundled list. Registry entries are configuration, not executable code. Removing a tag takes effect after refresh; an offline browser can keep its last valid list until it reconnects.

## Add the installation hook and button

```html
<a data-shot2ai="YOUR_ASSIGNED_TAG"
   data-shot2ai-url="https://example.com/mods/current-mod"
   href="https://github.com/iOSDevSK/shot2ai#install"
   target="_blank" rel="noopener noreferrer">
  <span data-shot2ai-install>Get Shot2AI — understand this with your AI</span>
  <span data-shot2ai-ready hidden>Explain with Shot2AI</span>
</a>
```

Keep `[hidden]` elements hidden in your CSS. Without Shot2AI, the link opens its installation instructions. Installed users enable **Settings → Website integrations**, grant the optional site access once, and reload your page. The extension changes the label to **Explain with Shot2AI**. A real click opens the answer card and sends the registered prompt plus the target URL using the user's AI destination and automatic-send preferences. The first-use chat notice still applies. No screenshot or page text is attached. Follow-up messages stay in the card.

Both the source page and the target URL must be inside the approved origin/path. Subdomains are separate registrations. Embedded frames and synthetic clicks cannot trigger a send. Do not put a prompt, extension ID, private key or secret in the tag. Give each button a normal install URL so visitors without the extension have a useful action.

## Agentmods

- Scope: `https://agentmods.dev/`
- Assigned tag: `s2ai-86b27adc1b21ccfd`
- Prompt: the Agentmods entry in [`src/integration-registry.json`](../src/integration-registry.json)

The registry is published in this repository and bundled with Shot2AI releases. Publish the Agentmods website component separately before visitors can use its button; packaging the extension does not deploy the Agentmods website.
