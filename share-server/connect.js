// Served only by the sharing site, never loaded as extension code.
const params = new URLSearchParams(location.search), extension = params.get('extension'), nonce = params.get('nonce');
const status = document.getElementById('status');
async function start() {
  if (!/^[a-p]{32}$/.test(extension || '') || !/^[0-9a-f-]{36}$/.test(nonce || '') || !globalThis.chrome?.runtime?.sendMessage) throw new Error('Open Share from your Shot2AI extension to verify this browser.');
  const response = await fetch('/api/sharing-config'); if (!response.ok) throw new Error('Verification is temporarily unavailable.');
  const { sitekey } = await response.json();
  const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.onload = () => window.turnstile.render('#verification', { sitekey, action: 'authorize', callback: async turnstileToken => {
    status.textContent = 'Finishing verification…';
    try {
      const result = await fetch('/api/authorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turnstileToken }) });
      if (!result.ok) throw new Error(result.status === 429 ? 'Too many attempts. Try again later.' : 'Verification failed. Open Share again to retry.');
      const authorization = await result.json();
      const accepted = await chrome.runtime.sendMessage(extension, { type: 'share-authorized', nonce, authorization });
      if (!accepted?.ok) {
        const errors = {
          'request-expired': 'This verification request expired. Return to your capture and choose Share again.',
          'request-missing': 'This sharing request is no longer active. Return to your capture and choose Share again.',
          'request-mismatch': 'A different sharing request is active. Return to your capture and choose Share again.',
          'authorization-invalid': 'The extension could not accept the verification. Update Shot2AI and check your computer’s date and time, then try Share again.',
        };
        throw new Error(errors[accepted?.reason] || 'The extension could not accept this verification. Reload Shot2AI in chrome://extensions, then choose Share again.');
      }
      status.textContent = 'Verified. Returning to your conversation…';
    } catch (e) { status.textContent = e.message; }
  }, 'error-callback': () => { status.textContent = 'Verification could not complete. Refresh this page to try again.'; } });
  script.onerror = () => { status.textContent = 'Could not load verification. Check your connection and refresh this page.'; };
  document.head.append(script); status.textContent = 'Complete the verification below if requested.';
}
start().catch(e => { status.textContent = e.message; });
