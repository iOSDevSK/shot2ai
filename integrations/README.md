# Add a Shot2AI button to a website

A registration contains only a public HTTPS URL (optionally a path prefix) and a prompt. The website provides a tag and the target page's URL; the extension gets the prompt from the reviewed registry, never from page JavaScript.

## Submit and approve

1. Add `integrations/requests/your-site.json` in a pull request:
   ```json
   { "url": "https://example.com/mods/", "prompt": "Explain this mod and how to use it." }
   ```
2. Run `python3 scripts/integrations.py --validate`. The output includes the stable `s2ai-…` tag. It is derived from the canonical URL, so editing a prompt does not change its tag. A previewed tag is not active until the registration is approved and merged.
3. The maintainer reviews the domain, scope and prompt, then merges the PR. Use branch protection / required reviews on `main` to make that approval mandatory.
4. The **Website integrations** GitHub Actions workflow regenerates and commits `integrations/registry.json` and the bundled `src/integration-registry.json`. The repository must permit the workflow's `GITHUB_TOKEN` to push the generated commit to `main`. If branch rules disallow this, generate the two files locally and include them in the approved PR instead; do not weaken branch protection just for the bot.
5. Copy the tag from the workflow output or generated registry into your website.

The extension checks the public registry at most once every 15 minutes when a tagged button is encountered. Offline it uses the last valid list, or the list bundled in its release. New entries therefore do not require a new extension build. Registry entries are configuration, not executable code. Removing a tag takes effect after refresh; an offline browser can keep its last valid list until it reconnects.

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
- Prompt: `requests/agentmods.json`
- Local site component: `web/src/components/Shot2AI.astro` in the Agentmods repository, included on each mod detail page.

The registry is published in this repository and bundled with Shot2AI releases. Publish the Agentmods website component separately before visitors can use its button; packaging the extension does not deploy the Agentmods website.
