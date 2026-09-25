// The preview card: the captures of this tab as a stack of cards in the
// page's corner. The newest is on top and the older ones peek out behind it;
// ‹ › (or ← →) flip through them. Each card keeps its own message and result.
// One click sends the front card to the default destination; Annotate opens
// the editor. Everything else goes through the extension's service worker,
// which keeps the stack, so it survives navigation within the tab. Only the
// clipboard is written here, while the page has focus.
//
// Sent to ChatGPT, Claude, Gemini or Perplexity, the card turns into an answer card: "Sending…",
// then the chat's answer as the service worker reads it from the chat's tab.
// The answer arrives as a tree of paragraphs, lists, code and links and is
// built here from text only (createElement, textContent): nothing from the
// chat's page is ever parsed as HTML on this page.
(() => {
  // Injected again with every capture: the first copy on the page does the work.
  if (window.__shot2aiStack) return;
  const CSS = `
    :host{all:initial}
    *{box-sizing:border-box}
    .deck{position:fixed;right:20px;bottom:20px;width:280px;font:13px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;color:#232a23}
    .peek{position:absolute;left:0;right:0;bottom:0;border:1px solid #d3d8cc;border-radius:14px;background:#fff;box-shadow:0 -1px 0 rgba(35,42,35,.04),0 8px 24px rgba(35,42,35,.18);transform-origin:50% 0;cursor:pointer;transition:transform .18s ease,opacity .18s ease}
    .peek:hover{background:#f1f5ec;border-color:#b9c3b0}
    .more-badge{position:absolute;right:10px;top:-11px;padding:2px 7px;border-radius:999px;background:#2f3c30;color:#fff;font-size:10.5px;font-weight:650;z-index:6}
    .card{position:relative;z-index:5;padding:10px;border:1px solid #e3e6dd;border-radius:14px;background:#fafaf8;box-shadow:0 1px 2px rgba(35,42,35,.08),0 14px 40px rgba(35,42,35,.22);animation:in .18s ease-out}
    @keyframes in{from{opacity:0;transform:translateY(10px) scale(.98)}}
    .deck.out{opacity:0;transform:translateY(10px);transition:opacity .2s,transform .2s}
    .body.flip-next{animation:next .18s ease-out}
    .body.flip-prev{animation:prev .18s ease-out}
    @keyframes next{from{opacity:.2;transform:translateX(14px)}}
    @keyframes prev{from{opacity:.2;transform:translateX(-14px)}}
    @media (prefers-reduced-motion:reduce){.card,.body.flip-next,.body.flip-prev{animation:none}.peek{transition:none}}
    button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
    button:disabled{cursor:default;opacity:.5}
    svg{width:16px;height:16px;display:block}
    .shot{position:relative;display:grid;place-items:center;height:132px;border-radius:9px;background:#eef0ea;overflow:hidden}
    .text-preview{width:100%;height:100%;box-sizing:border-box;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:36px 16px 32px;text-align:left;font:13px/1.5 system-ui;user-select:text}
    .card.answering .text-preview{padding:10px 40px 10px 12px}
    .shot canvas{display:block;max-width:100%;max-height:132px;border-radius:4px;box-shadow:0 0 0 1px rgba(35,42,35,.08)}
    .close{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(35,42,35,.62);color:#fff}
    .close svg{width:12px;height:12px}
    .close:hover{background:rgba(35,42,35,.85)}
    .nav{position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:1px;height:24px;padding:0 2px;border-radius:999px;background:rgba(35,42,35,.62);color:#fff;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}
    .nav button{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:14px;line-height:1}
    .nav button:hover:not(:disabled){background:rgba(255,255,255,.18)}
    .nav .count{padding:0 3px;min-width:34px;text-align:center}
    .include{position:absolute;top:6px;right:36px;display:flex;align-items:center;gap:4px;height:24px;padding:0 8px 0 6px;border-radius:999px;background:rgba(255,255,255,.92);color:#2f3c30;font-size:11px;font-weight:600;cursor:pointer}
    .include input{margin:0;width:13px;height:13px;accent-color:#2f3c30}
    .chip{position:absolute;left:6px;bottom:6px;display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:rgba(47,60,48,.88);color:#fff;font-size:11px;font-weight:560}
    .chip svg{width:11px;height:11px}
    .sent-badge{position:absolute;left:6px;bottom:6px;padding:3px 8px;border-radius:999px;background:#16964c;color:#fff;font-size:11px;font-weight:600}
    .meta{position:absolute;right:6px;bottom:6px;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.9);color:#4d5a47;font-size:10.5px;font-weight:600;font-variant-numeric:tabular-nums}
    .compose{display:flex;gap:6px;margin:9px 0 8px}
    .prompt{flex:none;width:86px;height:34px;padding:0 6px 0 9px;border:1px solid #dfe2d9;border-radius:8px;background:#fff;color:#4d5a47;font:600 11.5px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
    .prompt:focus{outline:none;border-color:#547254;box-shadow:0 0 0 2px rgba(84,114,84,.2)}
    .message{min-width:0;flex:1;height:34px;margin:0;padding:0 10px;border:1px solid #dfe2d9;border-radius:8px;background:#fff;color:#232a23;font:13px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;outline:none}
    .message::placeholder{color:#a6ae9b}
    .message:focus{border-color:#547254;box-shadow:0 0 0 2px rgba(84,114,84,.2)}
    .split{position:relative;display:flex;height:36px;border-radius:8px;background:#2f3c30;color:#fff}
    .send{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;padding:0 10px;border-radius:8px 0 0 8px;font-weight:600;font-size:12.5px;white-space:nowrap}
    .send span{overflow:hidden;text-overflow:ellipsis}
    .more{display:grid;place-items:center;width:34px;border-left:1px solid rgba(255,255,255,.18);border-radius:0 8px 8px 0}
    .send:hover:not(:disabled),.more:hover:not(:disabled){background:#465b43}
    .menu{position:absolute;right:0;bottom:42px;left:0;max-height:min(70vh,520px);overflow:auto;padding:5px;border:1px solid #e3e6dd;border-radius:10px;background:#fff;box-shadow:0 12px 32px rgba(35,42,35,.18);color:#232a23;z-index:1}
    .menu .head{padding:5px 8px 4px;font-size:10px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:#969f88}
    .menu .head.later{margin-top:4px;border-top:1px solid #eef0ea;padding-top:9px}
    .menu button{display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 8px;border-radius:6px;text-align:left;font-size:12.5px}
    .menu button:hover{background:#f1f3ee}
    .menu small{color:#969f88;font-size:11px}
    .menu .key{font-variant-numeric:tabular-nums;letter-spacing:.02em}
    .menu .item{display:flex;align-items:center;gap:2px;border-radius:6px}
    .menu .item:hover{background:#f1f3ee}
    .menu .item input{flex:none;width:15px;height:15px;margin:0 2px 0 7px;accent-color:#2f3c30;cursor:pointer}
    .menu .item button{flex:1;padding-left:5px}
    .menu .item button:hover{background:none}
    .menu .all{margin-top:4px;border-top:1px solid #eef0ea;border-radius:0;font-weight:600;color:#2f3c30}
    .menu .strong{font-weight:600;color:#2f3c30}
    .menu .options{border-top:1px solid #eef0ea;margin-top:4px;border-radius:0 0 6px 6px;color:#547254}
    .menu .new-chat{justify-content:flex-start;gap:8px;margin-top:4px;border-top:1px solid #eef0ea;border-radius:0}
    .menu .new-chat small{margin-left:auto}
    .menu .model{justify-content:flex-start;gap:8px}
    .menu .model span:nth-child(2){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .menu .model small{flex:none;margin-left:auto}
    .menu .model .dot{flex:none;width:14px;height:14px;border:1.5px solid #9fae94;border-radius:50%;background:#fff}
    .menu .model[aria-checked="true"] .dot{border:4.5px solid #2f3c30}
    .menu .hint{padding:0 8px 6px;font-size:10.5px;line-height:1.35;color:#969f88}
    .menu .new-chat .box{flex:none;width:15px;height:15px;border:1.5px solid #9fae94;border-radius:4px;background:#fff}
    .menu .new-chat[aria-checked="true"] .box{border-color:#2f3c30;background:#2f3c30 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12.5 4.5 4.5L19 7.5'/%3E%3C/svg%3E") center/11px no-repeat}
    .tools{display:flex;gap:2px;margin-top:8px}
    .tools button{flex:1;display:flex;align-items:center;justify-content:center;min-width:0;height:30px;padding:0 3px;gap:4px;border-radius:7px;color:#4d5a47;font-size:11px;font-weight:560;white-space:nowrap}
    .tools button:hover{background:#eef0ea}
    .tools svg{flex:none;width:14px;height:14px}
    .region-menu{margin-top:4px;padding:4px;border:1px solid #e3e6dd;border-radius:9px;background:#fff}
    .region-menu button{display:block;width:100%;padding:7px 8px;border-radius:6px;text-align:left;font-size:12px}
    .region-menu button:hover:not(:disabled){background:#f1f3ee}
    .result{margin-top:8px;padding:8px 10px;border:1px solid #e3e6dd;border-radius:8px;background:#fff;font-size:12px;line-height:1.45}
    .result.ok{border-color:#d5e3c8;background:#edf3e7;color:#34502a}
    .result.warn{border-color:#efe2c2;background:#faf3e3;color:#5f4a1f}
    .result.err{border-color:#eed8d0;background:#fbefeb;color:#6f3f33}
    .result .actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
    .result .actions button{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 8px;border:1px solid #dfe2d9;border-radius:6px;background:#fff;color:#2f3c30;font-size:11.5px;font-weight:600;white-space:nowrap}
    .result.choose-chat .actions{display:grid;max-height:180px;overflow-y:auto}
    .result.choose-chat .actions button{min-width:0;max-width:100%;justify-content:flex-start}
    .result.choose-chat .actions button span{min-width:0;overflow:hidden;text-overflow:ellipsis}
    .result.choose-chat .actions svg{flex-shrink:0}
    .result .actions button.primary{border-color:#2f3c30;background:#2f3c30;color:#fff}
    .result .actions svg{width:13px;height:13px}
    .result ul{margin:0;padding:0;list-style:none}
    .result li{display:flex;gap:6px;padding:2px 0}
    .result li b{font-weight:650;white-space:nowrap}
    .result li.fail{color:#6f3f33}
    .note{margin-top:8px;padding:7px 10px;border:1px solid #efe2c2;border-radius:8px;background:#faf3e3;color:#5f4a1f;font-size:11.5px;line-height:1.45}
    .toast{margin-top:8px;padding:6px 10px;border-radius:8px;background:#eef0ea;color:#4d5a47;font-size:11.5px}
    .saved{margin-top:6px;font-size:10.5px;color:#969f88;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .deck.wide{width:min(var(--answer-w,380px),calc(100vw - 40px))}
    .card.answering .shot{height:84px;flex-shrink:0}
    .card.answering .body{display:flex;flex-direction:column;max-height:calc(100dvh - 66px)}
    .answer{display:flex;flex-direction:column;min-height:0}
    .answer>div{flex-shrink:0}.answer .a-body{flex-shrink:1;min-height:60px}
    .a-sources ol{max-height:100px;overflow:auto}
    .grip{position:absolute;left:-7px;top:-7px;z-index:7;display:grid;place-items:center;width:20px;height:20px;border:1px solid #d3d8cc;border-radius:50%;background:#fff;color:#6f7c64;cursor:nwse-resize;box-shadow:0 1px 3px rgba(35,42,35,.18);touch-action:none}
    .grip svg{width:11px;height:11px}
    .grip:hover,.grip:focus-visible{color:#2f3c30;border-color:#9fae94}
    button:focus-visible,.message:focus-visible,.prompt:focus-visible{outline:2px solid rgba(84,114,84,.55);outline-offset:1px}
    .a-head{display:flex;align-items:center;gap:7px;margin-top:9px;font-size:12.5px;font-weight:650;color:#2f3c30}
    .a-icon{flex:none;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#edf3e7;color:#557843}
    .a-icon svg{width:11px;height:11px}
    .a-head.busy .a-icon{background:none;color:#547254}
    .a-head.busy .a-icon svg{width:15px;height:15px;animation:spin 1s linear infinite}
    .a-head.warn{color:#6f5320}.a-head.warn .a-icon{background:#faf3e3;color:#8a6a2c}
    .a-head.warn .a-icon::before{content:"!";font-size:11px;font-weight:800;line-height:1}
    @keyframes spin{to{transform:rotate(360deg)}}
    .a-asked{margin-top:6px;padding:5px 9px;border-radius:7px;background:#eef0ea;color:#4d5a47;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .a-body{margin-top:8px;max-height:min(46vh,420px);overflow:auto;padding:10px 12px;border:1px solid #e3e6dd;border-radius:9px;background:#fff;color:#232a23;font-size:13px;line-height:1.55;overscroll-behavior:contain;overflow-wrap:anywhere}
    .deck.sized .a-body{height:var(--answer-h);max-height:none}
    .a-body:focus-visible{outline:2px solid rgba(84,114,84,.45);outline-offset:1px}
    .a-body>:first-child{margin-top:0}.a-body>:last-child{margin-bottom:0}
    .a-body p{margin:0 0 .6em}
    .a-body h1,.a-body h2,.a-body h3,.a-body h4,.a-body h5,.a-body h6{margin:.9em 0 .35em;font-size:13.5px;font-weight:680;line-height:1.3}
    .a-body h1{font-size:15.5px}.a-body h2{font-size:14.5px}
    .a-body ul,.a-body ol{margin:0 0 .6em;padding-left:1.35em}
    .a-body li{margin:.18em 0}.a-body li>p{margin:0 0 .3em}.a-body li>:last-child{margin-bottom:0}
    .a-body code{padding:1px 4px;border-radius:4px;background:#f1f3ee;color:#2f3c30;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
    .a-body pre{margin:0 0 .7em;padding:9px 11px;border-radius:8px;background:#1f2620;color:#e6ece2;overflow:auto;white-space:pre;font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
    .a-body pre code{padding:0;background:none;color:inherit;font:inherit}
    .a-body pre .lang{display:block;margin-bottom:5px;color:#9fb09a;font:650 9.5px/1 ui-sans-serif,-apple-system,sans-serif;letter-spacing:.08em;text-transform:uppercase}
    .a-body blockquote{margin:0 0 .6em;padding-left:10px;border-left:3px solid #d3d8cc;color:#4d5a47}
    .a-body hr{margin:.8em 0;border:0;border-top:1px solid #e3e6dd}
    .a-body a{color:#3d6a3d;text-decoration:underline;text-underline-offset:2px}
    .a-body table{display:block;max-width:100%;overflow:auto;margin:0 0 .7em;border-collapse:collapse;font-size:12px}
    .a-body th,.a-body td{padding:4px 7px;border:1px solid #e3e6dd;text-align:left;vertical-align:top}
    .a-body th{background:#f5f7f2;font-weight:650}
    .a-body .hint{color:#6f7c64;font-size:12px}
    .a-body .caret{display:inline-block;width:7px;height:13px;margin-left:3px;border-radius:1px;background:#547254;vertical-align:-2px;animation:blink 1s steps(1) infinite}
    @keyframes blink{50%{opacity:0}}
    .a-body .skeleton i{display:block;height:9px;margin:4px 0 10px;border-radius:5px;background:linear-gradient(90deg,#eef0ea 20%,#f8f9f5 50%,#eef0ea 80%);background-size:200% 100%;animation:shimmer 1.3s linear infinite}
    .a-body .skeleton i:nth-child(2){width:86%}.a-body .skeleton i:nth-child(3){width:58%}
    @keyframes shimmer{to{background-position:-200% 0}}
    .a-note{margin-top:6px;font-size:11px;color:#8a6a2c}
    .a-sources{margin-top:8px}
    .a-sources h3{margin:0 0 4px;font-size:10px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:#969f88}
    .a-sources ol{display:flex;flex-direction:column;gap:3px;margin:0;padding:0;list-style:none;counter-reset:source}
    .a-sources li{display:flex;align-items:baseline;gap:6px;min-width:0;font-size:11.5px;counter-increment:source}
    .a-sources li::before{content:counter(source);flex:none;min-width:16px;padding:0 4px;border-radius:4px;background:#eef0ea;color:#4d5a47;font-size:10px;font-weight:650;text-align:center}
    .a-sources a{min-width:0;overflow:hidden;color:#3d6a3d;text-decoration:none;text-overflow:ellipsis;white-space:nowrap}
    .a-sources a:hover{text-decoration:underline}
    .a-sources small{flex:none;color:#969f88;font-size:10.5px}
    .a-turn{padding:12px 0;border-bottom:1px solid #e3e6dd}.a-turn:first-child{padding-top:0}
    .a-question{margin:0 0 10px!important;padding:8px 10px;border-radius:8px;background:#eef1e9;white-space:pre-wrap}
    .a-followup{display:flex;align-items:flex-end;gap:7px;margin-top:9px}
    .a-followup textarea{box-sizing:border-box;flex:1;min-width:0;resize:vertical;min-height:58px;max-height:120px;border:1px solid #dfe2d9;border-radius:8px;background:#fff;color:#232a23;padding:9px 10px;font:13px/1.4 ui-sans-serif,-apple-system,sans-serif}
    .a-followup textarea:focus{outline:2px solid #547254;outline-offset:1px}
    .a-followup button{width:34px;height:34px;border:0;border-radius:8px;background:#2f3c30;color:#fff;display:grid;place-items:center}
    .a-followup svg{width:18px;height:18px}.a-followup button:disabled{opacity:.4;cursor:default}
    .a-chat-error{margin-top:8px;color:#745820;font-size:12px;line-height:1.45}
    .a-actions button.chat-toggle{display:grid;place-items:center;gap:0;width:30px;padding:0}.chat-toggle[aria-expanded="true"]{background:#eef1e9}
    .a-actions{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;margin-top:9px}
    .a-actions button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:0;height:30px;padding:0 10px;border:1px solid #dfe2d9;border-radius:7px;background:#fff;color:#2f3c30;font-size:11.5px;font-weight:600;white-space:nowrap}
    .a-actions button:hover:not(:disabled){background:#f1f3ee}
    .a-actions button.primary{border-color:#2f3c30;background:#2f3c30;color:#fff}
    .a-actions button.primary:hover:not(:disabled){background:#465b43;border-color:#465b43}
    .a-actions button.quiet{margin-left:auto;border-color:transparent;background:none;color:#6f7c64}
    .a-actions > button{flex-shrink:1}.a-actions > button span{overflow:hidden;text-overflow:ellipsis}
    .a-actions button.chat-toggle{flex:none}
    .a-actions svg{flex:none;width:13px;height:13px}
    .a-actions .chat-toggle svg{width:16px;height:16px}
    @media (prefers-reduced-motion:reduce){.a-head.busy .a-icon svg,.a-body .caret,.a-body .skeleton i{animation:none}}
    .share-wrap{position:relative;flex:none;margin-left:auto}
    .a-actions .share-toggle{width:32px;padding:0}
    .share-toggle svg{width:18px;height:18px}
    .share-menu{position:absolute;right:0;bottom:38px;display:grid;width:min(318px,calc(100vw - 44px));grid-template-columns:repeat(6,minmax(0,1fr));gap:3px;padding:7px;border:1px solid #dfe2d9;border-radius:10px;background:#fff;box-shadow:0 8px 28px #232a2330;z-index:10}
    .share-note{grid-column:1/-1;font-size:10px;line-height:1.4;color:#67725f;padding:3px 4px;white-space:normal}
    .share-menu button{flex-direction:column;gap:4px;width:100%;height:54px;padding:4px;border:0;font-size:10px}
    .share-menu svg{width:22px;height:22px}
    .share-link{grid-column:1/-1;display:flex;align-items:center;gap:6px;margin:5px 2px 2px;padding:6px;border:1px solid #dfe2d9;border-radius:8px;background:#f7f8f4}
    .share-link input{flex:1;min-width:0;width:0;border:0;outline:0;background:transparent;padding:5px 2px;color:#2f3c30;font:11px/1.4 ui-sans-serif,-apple-system,sans-serif;text-overflow:ellipsis}
    .share-link input:focus-visible{outline:2px solid #547254;border-radius:3px}
    .share-menu .share-link button{flex:none;flex-direction:row;gap:5px;width:auto;min-width:76px;height:30px;padding:0 8px;border:1px solid #dfe2d9;border-radius:6px;background:#fff;font-size:11px}
    .share-link button svg{width:14px;height:14px}
    .share-status{font-size:12px;line-height:1.45;color:#745820;margin:6px 0 0;overflow-wrap:anywhere}
    [hidden]{display:none!important}
  `;
  // The first-use notice for web chats (settings.js websiteNotice, rebuilt here).
  const notice = (names, hosts, many, auto, answers = false, textOnly = false) => {
    const sent = auto ? ` and will be sent automatically, without you reviewing ${many ? 'them' : 'it'}${answers ? '; the answer then shows here' : ''}. Some services restrict automated use in their terms; turn Send automatically off in Options to review first` : '';
    return `${names} ${many ? 'are websites' : 'is a website'}. The ${textOnly ? 'selected text and prompt' : 'screenshot and message'} will go to ${hosts}, not only to this Mac${sent ? `,${sent}` : ''}.`;
  };
  const bytesOf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ask = async (message) => { try { return await chrome.runtime.sendMessage(message); } catch { return null; } };

  // ---- the answer, from its tree ------------------------------------------
  // Blocks: p, h, ul/ol, pre, quote, hr, table; inside them strings, b, i, s,
  // code, br, span and a (http and https only). Anything else is dropped.
  // Strings become text nodes: markup in an answer shows as the characters.
  const INLINE = { b: 'strong', i: 'em', s: 's', code: 'code', a: 'a', span: 'span' };
  function inlineTo(list, into, depth = 0) {
    if (!Array.isArray(list) || depth > 24) return;
    for (const x of list) {
      if (typeof x === 'string') { into.append(document.createTextNode(x)); continue; }
      if (x?.t === 'br') { into.append(document.createElement('br')); continue; }
      let tag = INLINE[x?.t];
      if (!tag) continue;
      const safe = tag === 'a' && typeof x.href === 'string' && /^https?:\/\//i.test(x.href);
      if (tag === 'a' && !safe) tag = 'span';
      const el = document.createElement(tag);
      if (safe) { el.href = x.href; el.target = '_blank'; el.rel = 'noopener noreferrer nofollow'; }
      if (tag === 'code') el.textContent = (x.c || []).filter((c) => typeof c === 'string').join('');
      else inlineTo(x.c, el, depth + 1);
      into.append(el);
    }
  }
  function blocksTo(list, into, depth = 0) {
    if (!Array.isArray(list) || depth > 12) return;
    for (const b of list) {
      let el = null;
      if (b?.t === 'p') { el = document.createElement('p'); inlineTo(b.c, el); }
      else if (b?.t === 'h') { el = document.createElement(`h${Math.min(6, Math.max(1, Number(b.l) || 3))}`); inlineTo(b.c, el); }
      else if (b?.t === 'pre') {
        el = document.createElement('pre');
        if (b.lang) { const lang = document.createElement('span'); lang.className = 'lang'; lang.textContent = String(b.lang).slice(0, 30); el.append(lang); }
        const code = document.createElement('code');
        code.textContent = String(b.text ?? '');
        el.append(code);
      } else if (b?.t === 'ul' || b?.t === 'ol') {
        el = document.createElement(b.t);
        if (b.t === 'ol' && Number(b.start) > 1) el.start = Number(b.start);
        for (const item of Array.isArray(b.items) ? b.items : []) {
          const li = document.createElement('li');
          // A list item of one paragraph shows as a line, not a spaced paragraph.
          if (item?.length === 1 && item[0]?.t === 'p') inlineTo(item[0].c, li); else blocksTo(item, li, depth + 1);
          el.append(li);
        }
      } else if (b?.t === 'quote') { el = document.createElement('blockquote'); blocksTo(b.c, el, depth + 1); }
      else if (b?.t === 'hr') el = document.createElement('hr');
      else if (b?.t === 'table') {
        el = document.createElement('table');
        for (const [index, row] of (Array.isArray(b.rows) ? b.rows : []).entries()) {
          const tr = document.createElement('tr');
          for (const cell of Array.isArray(row) ? row : []) { const td = document.createElement(b.head && index === 0 ? 'th' : 'td'); inlineTo(cell, td); tr.append(td); }
          el.append(tr);
        }
      }
      if (el) into.append(el);
    }
  }
  // The same tree as Markdown, for "Copy answer".
  function inlineMd(list) {
    return (Array.isArray(list) ? list : []).map((x) => {
      if (typeof x === 'string') return x;
      if (x?.t === 'br') return '  \n';
      const inner = x?.t === 'code' ? (x.c || []).join('') : inlineMd(x?.c);
      return { b: `**${inner}**`, i: `*${inner}*`, s: `~~${inner}~~`, code: `\`${inner}\``, a: `[${inner}](${x?.href})`, span: inner }[x?.t] ?? '';
    }).join('');
  }
  function markdown(list, indent = '') {
    const out = [];
    for (const b of Array.isArray(list) ? list : []) {
      if (b?.t === 'p') out.push(inlineMd(b.c));
      else if (b?.t === 'h') out.push(`${'#'.repeat(Math.min(6, Math.max(1, Number(b.l) || 3)))} ${inlineMd(b.c)}`);
      else if (b?.t === 'pre') out.push(`\`\`\`${b.lang || ''}\n${b.text || ''}\n\`\`\``);
      else if (b?.t === 'ul' || b?.t === 'ol') {
        out.push((b.items || []).map((item, n) => {
          const mark = b.t === 'ol' ? `${(Number(b.start) || 1) + n}. ` : '- ';
          const body = markdown(item, ' '.repeat(mark.length)).replace(/\n\n/g, '\n');
          return `${mark}${body.trimStart()}`;
        }).join('\n'));
      } else if (b?.t === 'quote') out.push(markdown(b.c).split('\n').map((l) => `> ${l}`).join('\n'));
      else if (b?.t === 'hr') out.push('---');
      else if (b?.t === 'table') {
        const rows = (b.rows || []).map((r) => `| ${(r || []).map((c) => inlineMd(c).replace(/\|/g, '\\|')).join(' | ')} |`);
        if (b.head && rows.length) rows.splice(1, 0, `|${(b.rows[0] || []).map(() => ' --- ').join('|')}|`);
        out.push(rows.join('\n'));
      }
    }
    return out.join('\n\n').split('\n').map((l, n) => (n && l ? indent + l : l)).join('\n');
  }

  // "Copy answer": the answer as Markdown, then its sources.
  function answerText(a) {
    const sources = (Array.isArray(a?.sources) ? a.sources : []).filter((x) => /^https?:\/\//i.test(x?.href || ''));
    return markdown(a?.blocks) + (sources.length ? `\n\nSources:\n${sources.map((x, n) => `${n + 1}. [${x.title || x.href}](${x.href})`).join('\n')}` : '');
  }

  let ui = null;

  // payload: the stack's captures (oldest first), which one is in front, and
  // what a card needs (destinations, prompts, icons…). `fresh` is a new capture's PNG.
  window.__shot2aiStack = (payload) => {
    if (!ui || !ui.host.isConnected) ui = build(payload);
    ui.update(payload);
    return true;
  };
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'shot2ai-answer' && ui?.host.isConnected) ui.answer(message.id, message.answer);
  });

  function build(first) {
    // An unpacked extension can load a new card while its older worker is
    // still alive. Keep the new chat control usable with an older icon payload.
    const i = { ...first.icons };
    const refreshIcons = (icons) => {
      Object.assign(i, icons);
      i.share ||= '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9H5v12h14V9h-2M12 15V2M8 6l4-4 4 4"/></svg>';
      i.link ||= '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 13 4-4M8 15l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M16 9l1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/></svg>';
      i.chat ||= '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg>';
    };
    refreshIcons(first.icons);
    document.getElementById('shot2ai-preview-card')?.remove();
    const host = document.createElement('div');
    host.id = 'shot2ai-preview-card';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    // A constructed stylesheet: a page's style-src policy does not apply to it.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
    root.innerHTML = `<div class="deck">
      <div class="peeks"></div>
      <div class="card" role="dialog" aria-label="Shot2AI screenshot preview" tabindex="-1"><button class="grip" aria-label="Resize the answer" title="Drag to resize (or use the arrow keys)" hidden>${i.grip}</button><div class="body">
        <div class="shot"><canvas aria-label="Captured area"></canvas><div class="text-preview" role="region" aria-label="Selected text" tabindex="0" hidden></div>
          <div class="nav" hidden><button class="prev" aria-label="Previous capture" title="Previous (←)">‹</button><span class="count" aria-live="polite"></span><button class="next" aria-label="Next capture" title="Next (→)">›</button></div>
          <label class="include" hidden><input type="checkbox" aria-label="Include in Send selected">Include</label>
          <button class="close" aria-label="Close this capture" title="Close this capture">${i.close}</button>
          <span class="chip" hidden>${i.check}<span></span></span><span class="sent-badge" hidden>Sent</span><span class="meta" title="Format and size of what is sent to web chats and saved"></span></div>
        <div class="compose"><select class="prompt" aria-label="Prompts" title="Fill the message with a saved prompt"><option value="" selected disabled>Prompt</option></select><input class="message" placeholder="Add a message (optional)" aria-label="Message" maxlength="2000"></div>
        <div class="split"><button class="send"><span></span></button><button class="more" aria-label="More destinations" aria-haspopup="menu" title="More destinations">${i.chevron}</button>
          <div class="menu" role="menu" hidden></div></div>
        <div class="tools">
          <button class="annotate" title="Open in the editor to draw arrows, boxes and text">${i.annotate}Annotate</button>
          <button class="copy" title="Copy to the clipboard">${i.copy}Copy</button>
          <button class="save" title="Save a copy">${i.download}Save</button>
          <button class="region" title="Remember this region, or capture the saved one" aria-haspopup="menu">${i.region}Region</button>
        </div>
        <div class="region-menu" role="menu" hidden>
          <button class="remember" role="menuitem">Remember this region</button>
          <button class="capture-saved" role="menuitem">Capture saved region</button>
        </div>
        <div class="answer" hidden>
          <div class="a-head"><span class="a-icon"></span><span class="a-status" role="status"></span></div>
          <div class="a-asked" hidden></div>
          <div class="a-body" tabindex="0" role="region"></div>
          <div class="a-sources" hidden><h3>Sources</h3><ol></ol></div>
          <div class="a-note" hidden></div>
          <div class="a-chat-error" role="alert" hidden></div>
          <div class="a-followup" hidden><textarea aria-label="Follow-up message" placeholder="Ask a follow-up…" rows="2"></textarea><button type="button" aria-label="Send follow-up" title="Send (Enter)">${i.send}</button></div>
          <div class="a-actions"></div>
        </div>
        <div class="note" role="note" hidden></div>
        <div class="toast" role="status" hidden></div>
        <div class="result" role="status" hidden></div>
        <div class="saved" hidden></div>
      </div></div>
    </div>`;
    const $ = (s) => root.querySelector(s);
    const deck = $('.deck');
    const card = $('.card');
    const input = $('.message');
    root.addEventListener('pointerdown', e => { if (!e.target.closest?.('.share-wrap')) { const menu = root.querySelector('.share-menu'); if (menu) { menu.hidden = true; menu.previousElementSibling.setAttribute('aria-expanded', 'false'); } } });
    let o = first;               // shared: destinations, main, prompts, icons…
    let entries = [];            // the stack, oldest first
    let current = 0;             // index of the front card
    let selecting = false;
    let busy = false;
    let hovered = false;
    let hideTimer = 0;
    let saveTimer = 0;
    const bitmaps = new Map();
    const pngs = new Map();
    const watchdogs = new Map();
    let chosenDestinations = [...(first.multi || [])];

    const now = () => entries[current];
    const unsent = () => entries.filter((e) => !e.sent);
    const persist = (id, patch) => ask({ type: 'stack-update', id, patch });

    // ---- drawing ----------------------------------------------------------

    function drawThumb(entry) {
      const canvas = $('canvas');
      const isText = entry.kind === 'text';
      canvas.hidden = isText;
      $('.text-preview').hidden = !isText;
      $('.text-preview').textContent = isText ? entry.selectedText : '';
      if (isText) return;
      const paint = (bitmap) => {
        if (now() !== entry) return;
        const small = card.classList.contains('answering');
        const room = Math.min((small ? 340 : 260) / bitmap.width, (small ? 84 : 132) / bitmap.height, 1);
        canvas.width = Math.max(1, Math.round(bitmap.width * room * 2));
        canvas.height = Math.max(1, Math.round(bitmap.height * room * 2));
        canvas.style.width = `${canvas.width / 2}px`;
        canvas.style.height = `${canvas.height / 2}px`;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      };
      if (bitmaps.has(entry.id)) { paint(bitmaps.get(entry.id)); return; }
      createImageBitmap(new Blob([bytesOf(entry.thumb)], { type: 'image/jpeg' })).then((b) => {
        if (!entries.includes(entry)) { b.close(); return; }
        bitmaps.set(entry.id, b); paint(b);
      });
    }

    function renderPeeks() {
      const peeks = $('.peeks');
      const behind = Math.min(4, entries.length - 1);
      const height = card.offsetHeight || 300;
      const layers = [];
      for (let k = behind; k >= 1; k--) {
        const layer = document.createElement('div');
        layer.className = 'peek';
        const index = (current - k + entries.length) % entries.length;
        layer.style.height = `${height}px`;
        // Scaled from the top edge, so each layer shows an 8 px strip above the one in front.
        layer.style.transform = `translateY(${-8 * k}px) scale(${1 - 0.035 * k})`;
        layer.style.opacity = String(1 - 0.08 * k);
        layer.style.zIndex = String(5 - k);
        layer.title = `Capture ${index + 1} of ${entries.length}`;
        layer.addEventListener('click', () => go(index, -1));
        layers.push(layer);
      }
      peeks.replaceChildren(...layers);
      if (entries.length > 5) {
        const badge = document.createElement('span');
        badge.className = 'more-badge';
        badge.style.top = `${-11 - 8 * behind}px`;
        badge.textContent = `+${entries.length - 5}`;
        badge.title = `${entries.length} captures in this tab`;
        peeks.append(badge);
      }
    }

    // The model for a send: the card's choice for this send, else the owner's
    // for this chat; '' is the chat's current model (nothing is switched).
    const modelFor = (d, entry) => (d?.models ? (typeof entry?.model === 'string' ? entry.model : d.models.choice) : '');
    const effortFor = (d, entry) => (d?.models?.effort ? (typeof entry?.effort === 'string' ? entry.effort : d.models.effort.choice) : '');
    function label() {
      const kind = o.main.kind;
      const svg = { copy: i.copy, save: i.download }[kind] || i.send;
      $('.send').innerHTML = `${svg}<span></span>`;
      // The model this send switches to, if any, and "New chat" from the menu.
      const model = kind === 'chat' ? modelFor(o.main, now()) : '';
      const effort = kind === 'chat' ? effortFor(o.main, now()) : '';
      const effortName = o.main.models?.effort?.options.find(([value]) => value === effort)?.[1];
      $('.send span').textContent = `${o.main.label}${model ? ` · ${model}` : ''}${effortName ? ` · ${effortName} effort` : ''}${kind === 'chat' && now()?.newChat ? ' (new chat)' : ''}`;
      $('.send').title = $('.send span').textContent;
    }

    function showResult(tone, text, actions = [], lines = null) {
      const box = $('.result');
      box.className = `result ${tone}`;
      box.textContent = text;
      if (lines) {
        const list = document.createElement('ul');
        for (const x of lines) {
          const li = document.createElement('li');
          li.className = x.ok ? 'ok' : 'fail';
          li.innerHTML = '<b></b><span></span>';
          li.querySelector('b').textContent = `${x.ok ? '✓' : '!'} ${x.name}`;
          li.querySelector('span').textContent = x.text;
          list.append(li);
        }
        box.replaceChildren(list);
      }
      if (actions.length) {
        const row = document.createElement('div');
        row.className = 'actions';
        for (const [name, run, primary, icon] of actions) {
          const b = document.createElement('button');
          if (primary) b.className = 'primary';
          b.innerHTML = `${icon ? i[icon] || '' : ''}<span></span>`;
          b.querySelector('span').textContent = name;
          b.addEventListener('click', run);
          row.append(b);
        }
        box.append(row);
      }
      box.hidden = !text && !lines;
    }
    // A result belongs to its card: kept, and shown again when it is in front.
    function setResult(entry, result) {
      entry.result = result;
      if (result?.persist !== false) persist(entry.id, { result: result && { tone: result.tone, text: result.text, lines: result.lines || null } });
      if (entry === now()) render();
    }

    function chip(text) { $('.chip span').textContent = text; $('.chip').hidden = !text || now()?.sent; }

    function render(direction = 0) {
      const entry = now();
      if (!entry) return;
      card.dataset.id = entry.id;
      const n = entries.length;
      $('.nav').hidden = n < 2;
      $('.count').textContent = `${current + 1} / ${n}`;
      $('.prev').disabled = n < 2;
      $('.next').disabled = n < 2;
      $('.include').hidden = !selecting;
      $('.include input').checked = !!entry.selected;
      if (document.activeElement !== host || root.activeElement !== input) input.value = entry.message || '';
      $('.meta').textContent = entry.meta || '';
      $('.meta').title = entry.kind === 'text' ? 'Selected text length; no image attached' : 'Format and size of what is sent to web chats and saved';
      $('.meta').hidden = !entry.meta;
      $('.note').textContent = entry.note || '';
      $('.note').hidden = !entry.note;
      $('.saved').textContent = $('.saved').title = entry.saved || '';
      $('.saved').hidden = !entry.saved;
      $('.sent-badge').hidden = !entry.sent;
      $('.chip').hidden = true;
      $('.remember').hidden = !entry.region?.canRemember;
      $('.capture-saved').disabled = !entry.region?.hasSaved;
      $('.region-menu').hidden = true;
      $('.annotate').hidden = $('.region').hidden = entry.kind === 'text';
      const r = entry.result;
      if (r?.actions === 'retry') showResult(r.tone, r.text, [['Try again', () => void sendTo(o.main), true, 'retry']]);
      else if (r?.actions === 'choose-chat') {
        const destination = o.destinations.find(d => d.id === r.destination);
        showResult(r.tone, r.text, destination ? r.tabs.map(t => [`Window ${t.window} · Tab ${t.index} — ${t.title}`, () => void sendTo(destination, true, { ...r.settings, targetTabId: t.id }), false, 'send']) : []);
        $('.result').classList.add('choose-chat');
      }
      else if (r?.actions === 'options') showResult(r.tone, r.text, [['Open Options', () => ask({ type: 'open-options' }), true]]);
      else if (r?.actions === 'open-chat') {
        const again = (r.retry || r.current) && o.destinations.find((d) => d.id === r.chat.destination);
        // The chosen model could not be had: send with the chat's current one instead.
        if (r.current && again) showResult(r.tone, r.text, [[r.reason?.startsWith('effort') ? 'Send with current settings' : 'Send with current model', () => void sendTo(again, true, { model: '', effort: '' }), true, 'send'], [`Open ${r.chat.name} tab`, () => openChat(r.chat), false, 'open']]);
        else showResult(r.tone, r.text, [[`Open ${r.chat.name} tab`, () => openChat(r.chat), true, 'open'], ...(again ? [[typeof r.retry === 'string' ? r.retry : 'Try again', () => void sendTo(again), false, 'retry']] : [])]);
      } else if (r) showResult(r.tone, r.text || '', [], r.lines || null);
      else showResult('', '');
      label();
      showAnswer(entry);
      drawThumb(entry);
      if (direction) {
        const body = $('.body');
        body.classList.remove('flip-next', 'flip-prev');
        void body.offsetWidth;
        body.classList.add(direction > 0 ? 'flip-next' : 'flip-prev');
      }
      requestAnimationFrame(renderPeeks);
    }

    // ---- the answer card ---------------------------------------------------------

    const openChat = (chat) => ask({ type: 'open-chat', tabId: chat.tabId, destination: chat.destination, url: chat.url });
    const FINAL = ['done', 'timeout', 'unreadable', 'gone', 'lost'];
    // Status, body and actions of the front card when it holds an answer.
    function showAnswer(entry) {
      const a = entry.answer;
      const on = !!a;
      card.classList.toggle('answering', on);
      deck.classList.toggle('wide', on);
      $('.grip').hidden = !on;
      $('.answer').hidden = !on;
      for (const part of ['.compose', '.split', '.tools']) $(part).hidden = on;
      if (!on) { card.setAttribute('aria-label', entry.kind === 'text' ? 'Shot2AI selected text preview' : 'Shot2AI screenshot preview'); return; }
      card.setAttribute('aria-label', `Shot2AI: ${a.name}'s answer`);
      for (const part of ['.region-menu', '.result', '.meta', '.note', '.saved', '.sent-badge']) $(part).hidden = true;
      const name = a.name;
      const blocks = Array.isArray(a.blocks) ? a.blocks : [];
      const [status, tone] = {
        sending: [`Sending to ${name}…`, 'busy'],
        answering: [`${name} is answering…`, 'busy'],
        done: [`${name} answered`, 'ok'],
        timeout: [blocks.length ? `${name} is still answering` : `No answer from ${name} yet`, 'warn'],
        lost: [`No answer from ${name} yet`, 'warn'],
        unreadable: [`${name} answered in its tab`, 'warn'],
        gone: [`The ${name} tab was closed`, 'warn'],
      }[a.state] || [name, 'ok'];
      $('.a-head').className = `a-head ${tone}`;
      $('.a-icon').innerHTML = tone === 'busy' ? i.spinner : tone === 'ok' ? i.check : '';
      if ($('.a-status').textContent !== status) $('.a-status').textContent = status;
      $('.a-asked').textContent = entry.asked || '';
      $('.a-asked').title = entry.asked || '';
      const history = entry.history || [];
      $('.a-asked').hidden = !entry.asked || history.length > 0;
      const body = $('.a-body');
      body.setAttribute('aria-label', `${name}'s answer`);
      body.setAttribute('aria-busy', String(!FINAL.includes(a.state)));
      // Kept at the bottom while the answer grows, unless the owner scrolled up.
      const atEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 24;
      const content = document.createDocumentFragment();
      const hint = (text) => { const el = document.createElement('p'); el.className = 'hint'; el.textContent = text; content.append(el); };
      const question = (text, parent) => { if (!text) return; const p = document.createElement('p'); p.className = 'a-question'; p.textContent = text; parent.append(p); };
      for (const turn of history) {
        const section = document.createElement('section'); section.className = 'a-turn';
        section.setAttribute('aria-label', 'Previous exchange');
        question(turn.asked, section); blocksTo(turn.answer?.blocks || [], section);
        for (const source of turn.answer?.sources || []) {
          if (!/^https?:\/\//i.test(source.href || '')) continue;
          const link = document.createElement('a'); link.href = source.href; link.textContent = source.title || source.href;
          link.target = '_blank'; link.rel = 'noopener noreferrer nofollow'; section.append(link, document.createElement('br'));
        }
        content.append(section);
      }
      if (history.length) question(entry.asked, content);
      blocksTo(blocks, content);
      if (a.state === 'sending') hint(history.length || entry.kind === 'text' ? `Sending your message to ${name}…` : `Shot2AI attaches the screenshot in the ${name} tab and sends it. You can keep working here.`);
      else if (a.state === 'answering' && !blocks.length) { const sk = document.createElement('div'); sk.className = 'skeleton'; sk.append(document.createElement('i'), document.createElement('i'), document.createElement('i')); content.append(sk); }
      else if (a.state === 'answering') { const caret = document.createElement('span'); caret.className = 'caret'; (content.lastElementChild?.matches('p, ul, ol') ? content.lastElementChild.querySelector('li:last-child') || content.lastElementChild : content).append(caret); }
      else if (a.state === 'timeout' || a.state === 'lost') hint(blocks.length ? `Shot2AI stopped waiting. The rest of the answer will be in the ${name} tab.` : `${name} has not answered, or something stopped it (a usage limit, a sign-in). See the ${name} tab.`);
      else if (a.state === 'unreadable') hint(`Shot2AI could not read the answer on the ${name} page. Open the ${name} tab to see it.`);
      else if (a.state === 'gone') hint('Shot2AI can no longer read the answer.');
      body.replaceChildren(content);
      if (atEnd) body.scrollTop = body.scrollHeight;
      // The answer's sources (Perplexity lists them): http and https only, in a new tab.
      const sources = (Array.isArray(a.sources) ? a.sources : []).filter((x) => typeof x?.href === 'string' && /^https?:\/\//i.test(x.href)).slice(0, 8);
      $('.a-sources ol').replaceChildren(...sources.map((x) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = x.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer nofollow';
        link.textContent = String(x.title || x.href).slice(0, 120);
        link.title = x.href;
        const host = document.createElement('small');
        try { host.textContent = new URL(x.href).hostname.replace(/^www\./, ''); } catch { /* shown without its site */ }
        li.append(link, host);
        return li;
      }));
      $('.a-sources').hidden = !sources.length;
      $('.a-note').textContent = a.truncated ? `The answer is longer than the card shows; see the rest in ${name}.` : '';
      $('.a-note').hidden = !a.truncated;
      const followup = $('.a-followup textarea');
      $('.a-followup').hidden = !entry.chatOpen;
      if (followup.value !== (entry.chatDraft || '')) followup.value = entry.chatDraft || '';
      followup.disabled = a.state !== 'done';
      $('.a-followup button').disabled = a.state !== 'done' || !followup.value.trim();
      $('.a-chat-error').textContent = entry.chatError || '';
      $('.a-chat-error').hidden = !entry.chatError;
      // Actions.
      const actions = [];
      const button = (text, run, cls = '', icon = '') => {
        const b = document.createElement('button');
        if (cls) b.className = cls;
        b.innerHTML = `${icon ? i[icon] || '' : ''}<span></span>`;
        b.querySelector('span').textContent = text;
        if (text) b.title = text;
        b.addEventListener('click', run);
        actions.push(b);
        return b;
      };
      const chat = { tabId: a.tabId, destination: a.destination, name, url: a.url };
      if (a.state === 'done') {
        const copyButton = button('Copy answer', async () => {
          let ok = false;
          try { await navigator.clipboard.writeText(answerText(a)); ok = true; } catch { /* the page lost focus */ }
          copyButton.querySelector('span').textContent = ok ? 'Copied' : 'Could not copy';
          setTimeout(() => { if (copyButton.isConnected) copyButton.querySelector('span').textContent = 'Copy answer'; }, 1600);
        }, 'primary', 'copy');
        button(`Continue in ${name}`, () => openChat(chat), '', 'open');
      } else if (a.state === 'answering') {
        button(`Continue in ${name}`, () => openChat(chat), '', 'open');
      } else if (a.state !== 'sending' && a.state !== 'gone') {
        button(`Open ${name} tab`, () => openChat(chat), 'primary', 'open');
        if (blocks.length) button('Copy answer', () => navigator.clipboard.writeText(answerText(a)).catch(() => {}), '', 'copy');
      }
      if (a.state === 'done' || entry.chatOpen) {
        const toggle = button('', () => {
          entry.chatOpen = !entry.chatOpen;
          persist(entry.id, { chatOpen: entry.chatOpen });
          showAnswer(entry);
          if (entry.chatOpen) $('.a-followup textarea').focus({ preventScroll: true });
        }, 'chat-toggle', 'chat');
        toggle.querySelector('span').remove();
        toggle.setAttribute('aria-label', 'Chat in this card'); toggle.title = 'Chat in this card';
        toggle.setAttribute('aria-expanded', String(!!entry.chatOpen));
      }
      if (FINAL.includes(a.state)) {
        const wrap = document.createElement('div'); wrap.className = 'share-wrap';
        const toggle = document.createElement('button'); toggle.className = 'share-toggle';
        toggle.innerHTML = i.share; toggle.title = 'Share conversation';
        toggle.setAttribute('aria-label', 'Share conversation'); toggle.setAttribute('aria-expanded', 'false');
        const menu = document.createElement('div'); menu.className = 'share-menu'; menu.hidden = true;
        menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'Share or export conversation');
        const close = (focus = false) => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); if (focus) toggle.focus(); };
        toggle.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button').focus(); });
        let sharing = false;
        const shareNote = 'WA, FB, X, Link: public for 30 days. PDF, MD: saved on your device.';
        const linkRow = document.createElement('div'); linkRow.className = 'share-link'; linkRow.hidden = true;
        const linkInput = document.createElement('input'); linkInput.type = 'text'; linkInput.readOnly = true;
        linkInput.setAttribute('aria-label', 'Public conversation link'); linkInput.spellcheck = false;
        linkInput.addEventListener('click', () => linkInput.select());
        const copyLink = document.createElement('button'); copyLink.disabled = true;
        copyLink.setAttribute('aria-label', 'Copy conversation link'); copyLink.title = 'Copy conversation link';
        copyLink.innerHTML = `${i.copy || i.link}<span>Copy</span>`;
        const hint = text => {
          root.querySelector('.share-status')?.remove();
          if (!wrap.isConnected) return;
          const el = document.createElement('p'); el.className = 'share-status'; el.setAttribute('role', 'status'); el.textContent = text;
          $('.a-actions').after(el);
        };
        copyLink.addEventListener('click', async () => {
          if (!linkInput.value) return;
          copyLink.querySelector('span').textContent = 'Copy';
          try {
            await navigator.clipboard.writeText(linkInput.value);
            copyLink.querySelector('span').textContent = 'Copied';
            setTimeout(() => { copyLink.querySelector('span').textContent = 'Copy'; }, 1600);
          } catch {
            linkInput.focus(); linkInput.select();
            hint(`Could not copy automatically. Press ${o.mod || 'Ctrl+'}C to copy the selected link.`);
          }
        });
        linkRow.append(linkInput, copyLink);
        wrap.addEventListener('keydown', e => {
          if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); e.stopPropagation(); close(true); }
          if (e.target === linkInput || e.metaKey || e.ctrlKey || e.altKey) return;
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !menu.hidden) {
            e.preventDefault(); e.stopPropagation();
            const buttons = [...menu.querySelectorAll('button')].filter(b => !b.disabled && !b.closest('[hidden]'));
            if (!buttons.length) return;
            const index = buttons.indexOf(root.activeElement);
            buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length].focus();
          }
        });
        wrap.addEventListener('focusout', () => setTimeout(() => { if (!sharing && !wrap.contains(root.activeElement)) close(); }, 0));
        for (const [format, label, icon] of [['whatsapp', 'WhatsApp', 'whatsapp'], ['facebook', 'Facebook', 'facebook'], ['x', 'X', 'x'], ['pdf', 'PDF', 'pdf'], ['md', 'MD', 'md'], ['link', 'Link', 'link']]) {
          const item = document.createElement('button'); item.title = format === 'link' ? 'Create a public conversation link' : ['pdf', 'md'].includes(format) ? label : `Share a public conversation link on ${label}`;
          item.setAttribute('aria-label', format === 'link' ? 'Get conversation link' : label === 'MD' ? 'Download Markdown' : label === 'PDF' ? 'Export PDF' : `Share on ${label}`);
          item.innerHTML = `${i[icon] || i.share}<span></span>`; item.querySelector('span').textContent = { whatsapp: 'WA', facebook: 'FB' }[format] || label;
          item.addEventListener('click', async () => {
            if (sharing) return;
            sharing = true;
            root.querySelector('.share-status')?.remove();
            const buttons = [...menu.querySelectorAll('button')]; buttons.forEach(b => { b.disabled = true; });
            const note = menu.querySelector('.share-note'); note.textContent = ['pdf', 'md'].includes(format) ? 'Preparing export…' : 'Creating public link…';
            if (format === 'link') {
              linkRow.hidden = false; linkInput.value = ''; linkInput.placeholder = 'Creating public link…';
            }
            let result;
            try { result = await ask({ type: 'share-conversation', id: entry.id, format }); }
            catch { result = { ok: false, text: 'Sharing failed. Check your connection and try again.' }; }
            finally { sharing = false; buttons.forEach(b => { b.disabled = false; }); note.textContent = shareNote; }
            if (!wrap.isConnected) return;
            if (result?.ok && format === 'link' && result.url) {
              linkInput.value = result.url; linkInput.title = result.url;
              if (!menu.hidden && document.hasFocus()) { linkInput.focus({ preventScroll: true }); linkInput.select(); }
            } else if (result?.ok && format !== 'link') close(true);
            else {
              if (format === 'link') { linkInput.placeholder = 'Link unavailable — try again'; if (!menu.hidden) item.focus(); }
              hint(result?.text || 'Reload Shot2AI and this page to share the conversation.');
            }
            copyLink.disabled = !linkInput.value;
          });
          menu.append(item);
        }
        menu.append(linkRow);
        const note = document.createElement('span'); note.className = 'share-note'; note.textContent = shareNote; menu.append(note);
        wrap.append(toggle, menu); actions.push(wrap);
      }
      $('.a-actions').replaceChildren(...actions);
      $('.a-actions').hidden = !actions.length;
    }
    async function followUp() {
      const entry = now();
      const text = (entry?.chatDraft || '').trim();
      if (busy || !text || entry.answer?.state !== 'done') return;
      const old = { answer: entry.answer, asked: entry.asked, history: entry.history || [] };
      const turnId = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('-');
      entry.history = [...old.history, { asked: old.asked, answer: old.answer }];
      entry.asked = text; entry.chatError = '';
      entry.answer = { ...old.answer, state: 'sending', turnId, blocks: [], sources: [] };
      setBusy(true); showAnswer(entry);
      $('.a-body').scrollTop = $('.a-body').scrollHeight;
      const r = await ask({ type: 'card-followup', id: entry.id, text, turnId });
      setBusy(false);
      if (r?.watching) {
        entry.chatDraft = '';
        if (entry.answer?.state === 'sending') entry.answer = r.answer;
        watch(entry);
      } else {
        Object.assign(entry, old);
        entry.chatError = r?.text || (!r || !Object.keys(r).length ? 'Reload Shot2AI in your browser’s Extensions page, then refresh this page. Copy your draft before refreshing; the running extension could not receive the follow-up.' : 'The message could not be confirmed. Check the chat tab before trying again.');
      }
      if (entry === now()) { showAnswer(entry); if (!r?.watching) $('.a-followup textarea').focus({ preventScroll: true }); }
    }
    $('.a-followup button').addEventListener('click', () => void followUp());
    $('.a-followup textarea').addEventListener('input', (e) => {
      const entry = now(); if (!entry) return;
      entry.chatDraft = e.target.value;
      $('.a-followup button').disabled = entry.answer?.state !== 'done' || !entry.chatDraft.trim();
      persist(entry.id, { chatDraft: entry.chatDraft });
    });
    $('.a-followup textarea').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); void followUp(); }
    });
    // Without a word from the service worker for a while, the card stops waiting.
    function watch(entry) {
      clearTimeout(watchdogs.get(entry.id));
      if (entry.answer?.state !== 'answering') { watchdogs.delete(entry.id); return; }
      watchdogs.set(entry.id, setTimeout(() => {
        if (entry.answer?.state !== 'answering') return;
        entry.answer = { ...entry.answer, state: 'lost' };
        if (entry === now()) render();
      }, o.watchdog || 20000));
    }
    // The owner resizes the answer by its top-left corner (the card sits in
    // the bottom-right one), or with the arrow keys on that grip.
    const grip = $('.grip');
    function resizeTo(width, height) {
      const w = Math.round(Math.min(Math.max(width, 300), Math.min(760, innerWidth - 40)));
      const h = Math.round(Math.min(Math.max(height, 120), Math.max(140, innerHeight - 320)));
      deck.style.setProperty('--answer-w', `${w}px`);
      deck.style.setProperty('--answer-h', `${h}px`);
      deck.classList.add('sized');
      requestAnimationFrame(renderPeeks);
    }
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const start = { x: e.clientX, y: e.clientY, w: deck.offsetWidth, h: $('.a-body').offsetHeight };
      const move = (ev) => resizeTo(start.w + start.x - ev.clientX, start.h + start.y - ev.clientY);
      const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
    grip.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 64 : 24;
      const by = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (!by) return;
      e.preventDefault();
      e.stopPropagation();
      resizeTo(deck.offsetWidth + by[0], $('.a-body').offsetHeight + by[1]);
    });

    function go(index, direction) {
      if (!entries.length) return;
      current = (index + entries.length) % entries.length;
      render(direction);
    }

    // ---- showing and hiding -------------------------------------------------

    function toast(text) {
      $('.toast').textContent = text;
      $('.toast').hidden = !text;
      if (text) setTimeout(() => { if ($('.toast').textContent === text) $('.toast').hidden = true; }, 6000);
    }

    // Leaving: fade out, then go. A capture arriving meanwhile cancels it.
    let leaving = 0;
    function leave() {
      clearTimeout(hideTimer);
      clearTimeout(leaving);
      deck.classList.add('out');
      leaving = setTimeout(() => { window.removeEventListener('keydown', onKey, true); host.remove(); }, 200);
    }
    // Esc: the stack leaves the screen; its captures wait for the next capture.
    function dismiss() {
      leave();
      ask({ type: 'stack-hide' });
    }
    function removeEntry(entry, tell = true) {
      const at = entries.indexOf(entry);
      if (at < 0) return;
      entries.splice(at, 1);
      clearTimeout(watchdogs.get(entry.id));
      if (tell) ask({ type: 'stack-remove', id: entry.id });
      if (!entries.length) { leave(); return; }
      current = Math.min(at, entries.length - 1);
      render();
    }
    // After a send, only the sent cards leave; never while the owner is on the card.
    function scheduleHide() {
      clearTimeout(hideTimer);
      // An answer stays until the owner closes it.
      if (!entries.some((e) => e.sent && !e.answer) || hovered || root.activeElement === input) return;
      hideTimer = setTimeout(() => {
        for (const e of entries.filter((x) => x.sent && !x.answer)) removeEntry(e);
      }, 6000);
    }
    card.addEventListener('mouseenter', () => { hovered = true; clearTimeout(hideTimer); });
    card.addEventListener('mouseleave', () => { hovered = false; scheduleHide(); });
    input.addEventListener('focus', () => clearTimeout(hideTimer));
    input.addEventListener('blur', () => setTimeout(scheduleHide, 0));
    input.addEventListener('click', () => {
      // Only the automatic prefill is disposable. A chosen prompt or the
      // owner's text remains editable, even if it equals the default.
      if (!now()?.messageDefault) return;
      input.value = '';
      input.dispatchEvent(new Event('input'));
    });
    input.addEventListener('input', () => {
      clearTimeout(hideTimer);
      const entry = now();
      entry.message = input.value;
      entry.messageDefault = false;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => persist(entry.id, { message: entry.message, messageDefault: false }), 300);
    });
    // X's Mousetrap shortcuts also listen to keypress and keyup. Outside our
    // closed shadow root their target is the host DIV, not the input, so the
    // site's editable-field guard cannot recognize typing here. Contain all
    // three events, without cancelling native editing/copy/paste defaults.
    for (const type of ['keypress', 'keyup']) root.addEventListener(type, (e) => e.stopPropagation());
    // Keys typed in the card stay in the card; ← → flip when not typing.
    card.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && e.target === input) { e.preventDefault(); void sendTo(o.main); return; }
      if (e.target === input || ['SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.target === grip || e.target.closest?.('.a-body')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1, -1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1, 1); }
    });
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key !== 'Escape') return;
      const sharing = root.querySelector('.share-menu:not([hidden])');
      if (sharing) { e.preventDefault(); e.stopPropagation(); sharing.hidden = true; const toggle = sharing.previousElementSibling; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); return; }
      if (!$('.menu').hidden) { $('.menu').hidden = true; return; }
      e.preventDefault(); e.stopPropagation(); dismiss();
    };
    window.addEventListener('keydown', onKey, true);

    // ---- clipboard, saving ----------------------------------------------------

    async function fullPng(entry) {
      if (!pngs.has(entry.id)) {
        const r = await ask({ type: 'stack-png', id: entry.id });
        if (!r?.png) return null;
        pngs.set(entry.id, new Blob([bytesOf(r.png)], { type: 'image/png' }));
      }
      return pngs.get(entry.id);
    }
    async function copy(entry, withText) {
      if (entry.kind === 'text') {
        const prompt = withText ? (entry.message || o.prompts?.[0]?.text || '').trim() : '';
        try { await navigator.clipboard.writeText([prompt, entry.selectedText].filter(Boolean).join('\n\n')); return true; } catch { return false; }
      }
      const png = await fullPng(entry);
      if (!png) return false;
      const items = { 'image/png': png };
      const text = (entry.message || '').trim();
      if (withText && text) items['text/plain'] = new Blob([text], { type: 'text/plain' });
      try { await navigator.clipboard.write([new ClipboardItem(items)]); return true; } catch { return false; }
    }
    async function save(entry) {
      const r = await ask({ type: 'save', id: entry.id });
      entry.saved = r?.text || 'The capture could not be saved.';
      persist(entry.id, { saved: entry.saved });
      if (entry === now()) render();
    }

    // ---- sending the front card ------------------------------------------------

    const setBusy = (on, text = 'Sending…') => { busy = on; for (const b of root.querySelectorAll('.send,.more')) b.disabled = on; if (on) $('.send span').textContent = text; else label(); };
    function markSent(entry, result) {
      entry.sent = true;
      entry.message = '';
      persist(entry.id, { sent: true, message: '' });
      setResult(entry, result);
      if (entry === now()) { input.value = ''; input.blur(); }
      scheduleHide();
    }

    async function sendTo(destination, confirmed = false, { model: forced, effort: forcedEffort, targetTabId } = {}) {
      const entry = now();
      if (busy || !entry) return;
      $('.menu').hidden = true;
      if (destination.kind === 'copy') { chip((await copy(entry, true)) ? 'Copied' : ''); return; }
      if (destination.kind === 'save') { await save(entry); return; }
      const text = (entry.message || '').trim();
      if (destination.kind === 'chat') {
        // A web chat is a website: say so once, before anything goes there.
        if (!confirmed && !o.acknowledged[destination.origin]) {
          showResult('warn', notice(destination.name, destination.host, false, destination.auto, destination.answers, entry.kind === 'text'),
            [['Continue', () => { o.acknowledged[destination.origin] = true; void sendTo(destination, true); }, true, 'send'], ['Cancel', () => showResult('', '')]]);
          return;
        }
        // Copied first, while this page has focus: the fallback if pasting fails.
        const copied = await copy(entry, true);
        // Sent automatically to a chat whose answer Shot2AI reads: the card becomes the answer card now.
        const answering = !!destination.answers;
        const chat = { destination: destination.id, name: destination.name };
        setBusy(true);
        if (answering) {
          entry.asked = text;
          entry.answer = { state: 'sending', name: destination.name, destination: destination.id, blocks: [] };
          const focused = root.activeElement && root.activeElement !== card;
          if (entry === now()) render();
          if (focused) card.focus({ preventScroll: true });
        }
        const newChat = !!entry.newChat;
        entry.newChat = false;
        // The card's model for this send (the menu's, or "Send with current
        // model"); otherwise the service worker uses the owner's choice.
        const model = typeof forced === 'string' ? forced : typeof entry.model === 'string' && destination.id === o.main.id ? entry.model : undefined;
        const effort = typeof forcedEffort === 'string' ? forcedEffort : typeof entry.effort === 'string' && destination.id === o.main.id ? entry.effort : undefined;
        entry.model = null;
        entry.effort = null;
        persist(entry.id, { model: null, effort: null, newChat: false });
        const r = await ask({ type: 'card-send', id: entry.id, destination: destination.id, text, acknowledge: destination.origin, newChat, model, effort, targetTabId });
        setBusy(false);
        chat.tabId = r?.tabId;
        if (r?.watching) {
          entry.asked = r.sentText ?? text;
          // The service worker may have sent the first words already.
          if (!entry.answer || entry.answer.state === 'sending') entry.answer = { state: 'answering', name: destination.name, destination: destination.id, tabId: r.tabId, blocks: [] };
          watch(entry);
          markSent(entry, { tone: 'ok', text: r.text });
          return;
        }
        entry.answer = null;
        if (r?.submitted || (r?.ok && !r.autoSubmit)) { markSent(entry, { tone: 'ok', text: r.text, ...(r.submitted && r.tabId ? { actions: 'open-chat', chat } : {}) }); return; }
        if (r?.reason === 'multipleTabs') {
          entry.newChat = newChat;
          entry.model = model;
          entry.effort = effort;
          setResult(entry, { tone: 'warn', text: r.text, actions: 'choose-chat', destination: destination.id, tabs: r.tabs, settings: { model, effort }, persist: false });
          return;
        }
        if (r?.reason === 'chatTabGone') { setResult(entry, { tone: 'warn', text: r.text, actions: 'retry', persist: false }); return; }
        if (r?.needsPermission) { setResult(entry, { tone: 'warn', text: `Allow the extension to use ${destination.host} in Options first.`, actions: 'options', persist: false }); return; }
        const open = r?.tabId ? { actions: 'open-chat', chat, persist: false } : {};
        if (r?.notAttached) { setResult(entry, { tone: 'warn', text: copied ? `${destination.name} did not take the image, so nothing was sent. It is on your clipboard: click the message box there and press ${o.mod}V.` : `${destination.name} did not take the image, so nothing was sent. Use Copy, then paste it there.`, ...open }); return; }
        if (r?.text) { setResult(entry, { tone: r.tone || 'warn', text: r.text, reason: r.reason, retry: r.retry || false, current: !!r.current, ...(r.open ? open : {}) }); return; }
        setResult(entry, { tone: copied ? 'warn' : 'err', text: copied ? `Copied. Paste with ${o.mod}V in ${destination.name}.` : `The ${entry.kind === 'text' ? 'text' : 'screenshot'} could not be pasted into ${destination.name}. Use Copy, then paste it there.`, ...open });
        return;
      }
      setBusy(true);
      const r = await ask({ type: 'card-send', id: entry.id, destination: 'html2wp', text });
      setBusy(false);
      if (r?.ok) { markSent(entry, { tone: 'ok', text: r.text }); return; }
      if (r?.unpaired) setResult(entry, { tone: 'warn', text: r.text, actions: 'options', persist: false });
      else setResult(entry, { tone: r?.reason !== undefined ? 'warn' : 'err', text: r?.text || 'html2wp did not answer.', actions: 'retry', persist: false });
    }

    // Several destinations for the front card.
    async function sendToMany(confirmed = false) {
      const entry = now();
      if (busy || !entry) return;
      $('.menu').hidden = true;
      const targets = o.destinations.filter((d) => chosenDestinations.includes(d.id));
      const chats = targets.filter((d) => d.kind === 'chat');
      const unknown = chats.filter((d) => !o.acknowledged[d.origin]);
      // One notice for every web chat in the set that has not been told yet.
      if (!confirmed && unknown.length) {
        showResult('warn', notice(unknown.map((d) => d.name).join(', '), unknown.map((d) => d.host).join(', '), unknown.length > 1, unknown.some((d) => d.auto), false, entry.kind === 'text'),
          [['Continue', () => { for (const d of unknown) o.acknowledged[d.origin] = true; void sendToMany(true); }, true, 'send'], ['Cancel', () => showResult('', '')]]);
        return;
      }
      if (chats.length) await copy(entry, true);
      setBusy(true, `Sending to ${targets.length}…`);
      const r = await ask({ type: 'card-send-many', id: entry.id, destinations: targets.map((d) => d.id), text: (entry.message || '').trim(), acknowledge: unknown.map((d) => d.origin) });
      setBusy(false);
      const lines = r?.results || [];
      const ok = lines.length > 0 && lines.every((x) => x.ok);
      if (ok) markSent(entry, { tone: 'ok', text: '', lines });
      else setResult(entry, { tone: 'warn', text: '', lines });
    }

    // Several captures at once, to the default destination: every unsent one,
    // or the ones ticked in select mode.
    async function sendCaptures(which, confirmed = false) {
      if (busy) return;
      $('.menu').hidden = true;
      const list = which === 'selected' ? entries.filter((e) => e.selected && !e.sent) : unsent();
      if (!list.length) return;
      const d = o.main;
      if (d.kind === 'chat' && !confirmed && !o.acknowledged[d.origin]) {
        showResult('warn', notice(d.name, d.host, false, d.auto),
          [['Continue', () => { o.acknowledged[d.origin] = true; void sendCaptures(which, true); }, true, 'send'], ['Cancel', () => showResult('', '')]]);
        return;
      }
      setBusy(true, `Sending ${list.length}…`);
      const text = list.map((e) => (e.message || '').trim()).filter(Boolean).join('\n\n');
      const newChat = !!now()?.newChat;
      if (now()) { now().newChat = false; persist(now().id, { newChat: false }); }
      const r = await ask({ type: 'send-captures', ids: list.map((e) => e.id), text, acknowledge: d.origin || null, newChat });
      setBusy(false);
      const sent = new Set(r?.sentIds || []);
      const tone = r?.ok ? (sent.size === list.length ? 'ok' : 'warn') : 'err';
      for (const e of list) {
        if (sent.has(e.id)) { e.sent = true; e.message = ''; e.selected = false; persist(e.id, { sent: true, message: '', selected: false }); e.result = { tone, text: r.text }; persist(e.id, { result: { tone, text: r.text } }); }
      }
      // The front card shows how it went, sent or not.
      const front = now();
      if (!sent.has(front.id)) setResult(front, { tone, text: r?.text || 'Nothing was sent.', persist: false });
      else render();
      if (sent.size) { input.value = ''; input.blur(); scheduleHide(); }
    }

    // ---- the menu -------------------------------------------------------------

    function openMenu() {
      const menu = $('.menu');
      if (!menu.hidden) { menu.hidden = true; return; }
      menu.innerHTML = '<div class="head">Send to</div>';
      // Tick several for "Send to all selected"; a name alone sends to that one.
      for (const d of o.destinations) {
        const row = document.createElement('div');
        row.className = 'item';
        row.innerHTML = '<input type="checkbox"><button role="menuitem"><span></span><small></small></button>';
        const tick = row.querySelector('input');
        tick.checked = chosenDestinations.includes(d.id);
        tick.setAttribute('aria-label', `Select ${d.name}`);
        tick.addEventListener('change', () => {
          chosenDestinations = tick.checked ? [...chosenDestinations, d.id] : chosenDestinations.filter((x) => x !== d.id);
          chrome.storage.local.set({ multiSend: chosenDestinations });
          all.textContent = `Send to all selected (${chosenDestinations.length})`;
          all.hidden = chosenDestinations.length < 2;
        });
        const b = row.querySelector('button');
        b.querySelector('span').textContent = d.name;
        b.querySelector('small').textContent = d.kind === 'html2wp' ? 'this Mac' : d.host;
        b.addEventListener('click', () => void sendTo(d));
        menu.append(row);
      }
      const all = document.createElement('button');
      all.className = 'all';
      all.setAttribute('role', 'menuitem');
      all.textContent = `Send to all selected (${chosenDestinations.length})`;
      all.hidden = chosenDestinations.length < 2;
      all.addEventListener('click', () => void sendToMany());
      menu.append(all);
      // Each screenshot continues the chat's conversation, unless the owner
      // asks for a new one here (for the next send only).
      if (o.destinations.some((d) => d.kind === 'chat')) {
        const entry = now();
        const fresh = document.createElement('button');
        fresh.className = 'new-chat';
        fresh.setAttribute('role', 'menuitemcheckbox');
        fresh.setAttribute('aria-checked', String(!!entry?.newChat));
        fresh.innerHTML = '<span class="box" aria-hidden="true"></span><span>New chat</span><small>next send only</small>';
        fresh.addEventListener('click', () => {
          if (!entry) return;
          entry.newChat = !entry.newChat;
          persist(entry.id, { newChat: entry.newChat });
          fresh.setAttribute('aria-checked', String(entry.newChat));
          label();
        });
        menu.append(fresh);
      }
      // The model for this send, from the chat's own list (read from its
      // picker), or its typical names until then; the popup keeps the choice.
      const view = o.main.kind === 'chat' ? o.main.models : null;
      if (view) {
        const entry = now();
        menu.insertAdjacentHTML('beforeend', '<div class="head later">Model for this send</div>');
        const names = [...view.names];
        if (view.choice && !names.includes(view.choice)) names.push(view.choice);
        const rows = [];
        for (const [value, text] of [['', "Use selected model in chat"], ...names.map((n) => [n, n])]) {
          const b = document.createElement('button');
          b.className = 'model';
          b.setAttribute('role', 'menuitemradio');
          b.innerHTML = '<span class="dot" aria-hidden="true"></span><span></span><small></small>';
          b.querySelector('span:nth-child(2)').textContent = text;
          b.querySelector('small').textContent = value === view.choice ? 'usual' : '';
          b.dataset.value = value;
          b.addEventListener('click', () => {
            if (!entry) return;
            entry.model = value;
            persist(entry.id, { model: value });
            for (const x of rows) x.setAttribute('aria-checked', String(x.dataset.value === value));
            label();
          });
          rows.push(b);
          menu.append(b);
        }
        for (const x of rows) x.setAttribute('aria-checked', String(x.dataset.value === modelFor(o.main, entry)));
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = view.live ? `Names from ${o.main.name}'s own list.` : view.note ? `${o.main.name}: ${view.note}.` : `Typical names; keep ${o.main.name} open in a tab to read its own list.`;
        menu.append(hint);
      }
      if (view?.effort) {
        const entry = now();
        menu.insertAdjacentHTML('beforeend', '<div class="head later">Thinking effort for this send</div>');
        const rows = [];
        for (const [value, text] of [['', "Use selected effort in chat"], ...view.effort.options]) {
          const b = document.createElement('button');
          b.className = 'model effort';
          b.setAttribute('role', 'menuitemradio');
          b.innerHTML = '<span class="dot" aria-hidden="true"></span><span></span><small></small>';
          b.querySelector('span:nth-child(2)').textContent = text;
          b.querySelector('small').textContent = value === view.effort.choice ? 'usual' : '';
          b.dataset.value = value;
          b.setAttribute('aria-checked', String(value === effortFor(o.main, entry)));
          b.addEventListener('click', () => {
            if (!entry) return;
            entry.effort = value;
            persist(entry.id, { effort: value });
            for (const row of rows) row.setAttribute('aria-checked', String(row.dataset.value === value));
            label();
          });
          rows.push(b);
          menu.append(b);
        }
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = "Position on ChatGPT's effort slider; levels depend on the model.";
        menu.append(hint);
      }
      const add = (text, run, cls = 'strong') => {
        const b = document.createElement('button');
        b.className = cls;
        b.setAttribute('role', 'menuitem');
        b.textContent = text;
        b.addEventListener('click', run);
        menu.append(b);
        return b;
      };
      if (entries.length > 1) {
        menu.insertAdjacentHTML('beforeend', '<div class="head later">Captures</div>');
        const canSendAll = o.main.kind === 'html2wp' || o.main.kind === 'chat' || o.main.kind === 'save';
        const verb = o.main.kind === 'save' ? 'Save' : 'Send';
        const waiting = unsent().length;
        if (canSendAll && waiting > 1) add(`${verb} all captures (${waiting})`, () => void sendCaptures('unsent'));
        const ticked = entries.filter((e) => e.selected && !e.sent).length;
        if (canSendAll && selecting && ticked) add(`${verb} selected captures (${ticked})`, () => void sendCaptures('selected'));
        add(selecting ? 'Done selecting' : 'Select captures', () => { selecting = !selecting; menu.hidden = true; render(); }, '');
        add('Clear all', () => { menu.hidden = true; ask({ type: 'stack-clear' }); entries = []; leave(); }, '');
      }
      const full = add('Capture full page', () => { dismiss(); ask({ type: 'full-page' }); }, 'options');
      if (o.keys?.['capture-full']) {
        const key = document.createElement('small');
        key.className = 'key';
        key.textContent = o.keys['capture-full'];
        full.append(key);
      }
      add('Add a chat in Options…', () => ask({ type: 'open-options' }), 'options');
      menu.hidden = false;
    }

    // ---- wiring ---------------------------------------------------------------

    $('.send').addEventListener('click', () => void sendTo(o.main));
    $('.more').addEventListener('click', openMenu);
    $('.prev').addEventListener('click', () => go(current - 1, -1));
    $('.next').addEventListener('click', () => go(current + 1, 1));
    $('.close').addEventListener('click', () => { const e = now(); if (e) removeEntry(e); });
    $('.include input').addEventListener('change', (ev) => { const e = now(); e.selected = ev.target.checked; persist(e.id, { selected: e.selected }); });
    $('.annotate').addEventListener('click', () => { const e = now(); ask({ type: 'annotate', id: e.id, text: (e.message || '').trim() }); dismiss(); });
    $('.copy').addEventListener('click', async () => chip((await copy(now(), false)) ? 'Copied' : ''));
    $('.save').addEventListener('click', () => void save(now()));
    // A remembered region is per site; its assigned shortcut and the right-click menu capture it too.
    $('.region').addEventListener('click', () => { $('.region-menu').hidden = !$('.region-menu').hidden; });
    $('.remember').addEventListener('click', async () => {
      const e = now();
      const r = await ask({ type: 'remember-region', id: e.id });
      $('.region-menu').hidden = true;
      if (r?.ok) { for (const x of entries) if (x.region) x.region.hasSaved = true; $('.capture-saved').disabled = false; chip('Region remembered'); }
    });
    $('.capture-saved').addEventListener('click', () => { dismiss(); ask({ type: 'capture-saved' }); });
    // A saved prompt fills the message; it can still be edited.
    const picker = $('.prompt');
    picker.addEventListener('change', () => {
      input.value = picker.value;
      picker.selectedIndex = 0;
      input.dispatchEvent(new Event('input'));
      input.focus();
    });

    document.documentElement.appendChild(host);

    return {
      host,
      // A new capture, a restore after navigation, or the popup's "Show".
      update(p) {
        o = p;
        refreshIcons(p.icons);
        chosenDestinations = [...(p.multi || [])];
        // An answer on its way here is newer than the one kept in storage.
        for (const e of p.entries) {
          const mine = entries.find((x) => x.id === e.id);
          if (mine && mine.thumb !== e.thumb) {
            bitmaps.get(e.id)?.close(); bitmaps.delete(e.id); pngs.delete(e.id);
          }
          if (mine?.answer && !FINAL.includes(mine.answer.state) && (!e.answer?.turnId || e.answer.turnId === mine.answer.turnId)) { e.answer = mine.answer; e.asked = mine.asked; e.history = mine.history; e.chatOpen = mine.chatOpen; e.chatDraft = mine.chatDraft; }
        }
        entries = p.entries;
        for (const e of entries) watch(e);
        const at = entries.findIndex((e) => e.id === p.currentId);
        current = at >= 0 ? at : entries.length - 1;
        picker.replaceChildren(new Option('Prompt', '', true, true));
        picker.options[0].disabled = true;
        for (const x of p.prompts || []) picker.append(new Option(x.name, x.text));
        picker.hidden = !(p.prompts || []).length;
        input.placeholder = p.prompts?.length ? `Default: ${p.prompts[0].name}` : 'Add a message (optional)';
        clearTimeout(leaving);
        deck.classList.remove('out');
        window.removeEventListener('keydown', onKey, true);
        window.addEventListener('keydown', onKey, true);
        render(0);
        if (p.dropped) toast(`The oldest ${p.dropped > 1 ? `${p.dropped} captures were` : 'capture was'} removed: a tab keeps ${p.cap} at most.`);
        if (p.focusMessage) input.focus({ preventScroll: true });
        if (p.fresh) {
          const entry = now();
          pngs.set(entry.id, new Blob([bytesOf(p.fresh)], { type: 'image/png' }));
          // Every capture is on the clipboard too, ready for ⌘V / Ctrl+V anywhere.
          copy(entry, false).then((ok) => { if (entry === now()) chip(ok ? 'Copied' : ''); });
          input.focus({ preventScroll: true });
        }
        // "Capture and send": no click needed; the card shows how it went.
        if (p.autoSend) void sendTo(o.main);
      },
      // The chat's answer, from the service worker.
      answer(id, answer) {
        const entry = entries.find((e) => e.id === id);
        // A follow-up may have been submitted while the source page was
        // navigating. Restore its persisted history before accepting its stream.
        if (entry && answer?.turnId && answer.turnId !== entry.answer?.turnId && FINAL.includes(entry.answer?.state)) {
          ask({ type: 'show-stack' }); return;
        }
        // A final answer stays; only the card's own "lost" gives way to news.
        if (!entry || !answer || (entry.answer?.turnId && answer.turnId !== entry.answer.turnId) || (entry.answer?.state !== 'lost' && FINAL.includes(entry.answer?.state))) return;
        entry.answer = { ...answer, tabId: answer.tabId ?? entry.answer?.tabId };
        watch(entry);
        if (entry === now()) { if (card.classList.contains('answering')) showAnswer(entry); else render(); }
      },
    };
  }
})();
