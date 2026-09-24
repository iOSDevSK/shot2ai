import { validateShareURL, socialURL } from './public-share.js';
const url = new URLSearchParams(location.search).get('url');
if (validateShareURL(url)) {
  const native = document.getElementById('native'); native.href = socialURL('whatsapp', url); native.hidden = false;
  const web = document.getElementById('web'); web.href = `https://web.whatsapp.com/send?text=${encodeURIComponent(url)}`; web.hidden = false;
  const conversation = document.getElementById('conversation'); conversation.href = url; conversation.hidden = false;
  // Chrome may ask permission to open an external app. Never claim it was sent.
  window.addEventListener('load', () => native.click(), { once: true });
  document.getElementById('status').textContent = 'If Chrome asks, allow it to open WhatsApp. Choose a recipient and send there. If the app did not open, use the link below.';
} else document.getElementById('status').textContent = 'This sharing link is invalid. Open Share again from your conversation card.';
