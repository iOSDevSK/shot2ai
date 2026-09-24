// Opt-in live test: node tests/live-gemini.mjs
// Sign into Gemini manually in the dedicated browser. Never reads credentials.
// Uses the actual service worker/card flow; only test permissions and shadow
// root accessibility differ from the release. No site/network mocks.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import http from 'node:http';
const root=resolve(import.meta.dirname,'..');
const output=process.env.SHOT2AI_SHOTS || mkdtempSync(join(tmpdir(),'shot2ai-gemini-live-'));
mkdirSync(output,{recursive:true});
const extension=mkdtempSync(join(tmpdir(),'shot2ai-live-ext-'));
for(const file of ['manifest.json','src','icons','licenses']) cpSync(join(root,file),join(extension,file),{recursive:true});
const manifest=JSON.parse(readFileSync(join(extension,'manifest.json'),'utf8'));
// A popup in a tab cannot grant activeTab like a real toolbar gesture.
manifest.host_permissions.push('<all_urls>');
writeFileSync(join(extension,'manifest.json'),JSON.stringify(manifest));
const cardPath=join(extension,'src/card.js');
writeFileSync(cardPath,readFileSync(cardPath,'utf8').replace("mode: 'closed'","mode: 'open'"));
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Shot2AI live Gemini test</title><body style="background:#f6f1ea;font:24px sans-serif;padding:60px"><h1>SHOT2AI LIVE CHECK</h1><p>This is a test screenshot.</p><p>Read the heading in this image.</p></body>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sourceUrl=`http://127.0.0.1:${server.address().port}/`;
const profile=process.env.SHOT2AI_LIVE_PROFILE || mkdtempSync(join(tmpdir(),'shot2ai-live-profile-'));
const context=await chromium.launchPersistentContext(profile,{
 ...(process.env.SHOT2AI_LIVE_CHROME ? {executablePath:process.env.SHOT2AI_LIVE_CHROME} : {channel:'chromium'}),headless:false,viewport:null,
 ignoreDefaultArgs:['--disable-extensions','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding'],
 args:['--enable-unsafe-extension-debugging','--window-size=1280,900',...(process.env.SHOT2AI_LIVE_CHROME ? [] : [`--disable-extensions-except=${extension}`,`--load-extension=${extension}`])],
});
let installedId;
if(process.env.SHOT2AI_LIVE_CHROME){
 const cdp=await context.browser().newBrowserCDPSession();
 const installed=await cdp.send('Extensions.loadUnpacked',{path:extension});
 installedId=installed.id;
 console.log('EXTENSION_INSTALLED',installed.id);
 const bootstrap=await context.newPage();
 await bootstrap.goto(`chrome-extension://${installed.id}/src/popup.html`);
 await bootstrap.evaluate(()=>chrome.runtime.sendMessage({type:'read-models',destination:'gemini'}));
 await bootstrap.close();await cdp.detach();
}
const isOwnWorker=w=>!installedId || new URL(w.url()).host===installedId;
const worker=context.serviceWorkers().find(isOwnWorker) || await context.waitForEvent('serviceworker',{predicate:isOwnWorker});
const extensionId=new URL(worker.url()).host;
const report={version:manifest.version,output,profile,phase:'login',runs:[]};
const publish=()=>writeFileSync(join(output,'result.json'),JSON.stringify(report,null,2));
publish();
const gemini=await context.newPage();
await gemini.goto(process.env.SHOT2AI_LIVE_REUSE || 'https://gemini.google.com/app');
console.log(`LOGIN_REQUIRED: Sign into Gemini in the dedicated Chromium window. Report: ${output}/result.json`);
let traced=false;
try {
 await gemini.locator('a[href*="accounts.google.com/SignOutOptions"], button[aria-label*="Google Account"]').first().waitFor({state:'attached',timeout:20*60*1000});
 await gemini.locator('rich-textarea .ql-editor[contenteditable="true"]').waitFor({state:'visible',timeout:20*60*1000});
 console.log('LOGIN_READY');
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});traced=true;
 await worker.evaluate(model=>chrome.storage.local.set({defaultDestination:'gemini',presets:{gemini:true},modelChoice:model?{gemini:model}:{},effortChoice:{},autoSubmit:{gemini:true}}),process.env.SHOT2AI_LIVE_MODEL || '');
 let userCount=await gemini.locator('user-query').count();
 const source=await context.newPage();await source.goto(sourceUrl);
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:sourceUrl});
 const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,sourceUrl);
 let foregrounded=false;
 await gemini.exposeFunction('__shot2aiLiveActivated',()=>{foregrounded=true;});
 await gemini.evaluate(()=>document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.__shot2aiLiveActivated();}));
 for(let run=process.env.SHOT2AI_LIVE_REUSE ? 1 : 0;run<(process.env.SHOT2AI_LIVE_FOLLOWUP ? 1 : 2);run++) {
  if(run===1){
   report.phase='idle-before-reuse';publish();
   // Exercise Chromium's >5 minute background timer throttling, with no
   // evaluation/screenshots in Gemini during this period.
   const idle=process.env.SHOT2AI_LIVE_IDLE===undefined ? 360 : Number(process.env.SHOT2AI_LIVE_IDLE);
   for(let n=0;n<idle;n+=30){
    if(source.isClosed()||gemini.isClosed())throw new Error('Live test interrupted: a test tab was closed during the background wait');
    await source.evaluate(seconds=>{let label=document.getElementById('test-countdown');if(!label){label=document.createElement('p');label.id='test-countdown';label.style.cssText='position:fixed;bottom:20px;left:30px;padding:20px;background:white;font:20px sans-serif';document.body.append(label);}label.textContent=`Playwright test beží — nezatváraj toto okno. Druhé odoslanie o ${seconds} s. Okno sa po teste zavrie samo.`;},idle-n);
    console.log(`BACKGROUND_IDLE ${n}/${idle} seconds`);await new Promise(r=>setTimeout(r,Math.min(30,idle-n)*1000));
   }
   await source.evaluate(()=>document.getElementById('test-countdown')?.remove());
  }
  report.phase=`sending-${run+1}`;publish();
  const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  if(process.env.SHOT2AI_LIVE_IMAGE){
   const png=readFileSync(process.env.SHOT2AI_LIVE_IMAGE).toString('base64');
   const imported=await popup.evaluate(async({tabId,png})=>chrome.runtime.sendMessage({type:'import-image',tabId,png}),{tabId,png});
   if(!imported?.ok)throw new Error('Image import failed');
  }else{
  await popup.getByRole('button',{name:'Capture area'}).click();
  await source.locator('#shot2ai-area-select').waitFor({state:'attached'});
  if(!popup.isClosed())await popup.close();await source.bringToFront();
  await source.mouse.move(45,45);await source.mouse.down();await source.mouse.move(780,310,{steps:12});await source.mouse.up();
  }
  if(!popup.isClosed())await popup.close();await source.bringToFront();
  const card=source.locator('#shot2ai-preview-card .card');await card.waitFor();
  await card.getByLabel('Message',{exact:true}).fill(process.env.SHOT2AI_LIVE_PROMPT || 'Read the heading in the image. Reply with the heading only.');
  await card.getByRole('button',{name:/^Send to Gemini/}).click();
  const notice=card.locator('.result').getByRole('button',{name:'Continue',exact:true});
  if(await notice.isVisible().catch(()=>false))await notice.click();
  let error=null;
  try{await expect(card.locator('.a-status')).toBeVisible({timeout:110000});await expect(card.locator('.a-status')).toHaveText('Gemini answered',{timeout:110000});await expect(gemini.locator('user-query')).toHaveCount(userCount+1,{timeout:15000});userCount++;await expect(card.locator('.a-body')).toContainText(process.env.SHOT2AI_LIVE_EXPECT || 'SHOT2AI LIVE CHECK');}catch(e){error=e.message;}
  const diagnostics=error?await gemini.evaluate(()=>({users:document.querySelectorAll('user-query').length,answers:document.querySelectorAll('model-response').length,latest:document.querySelector('model-response:last-of-type')?.innerText,stop:!!document.querySelector('button[aria-label^="Stop"]'),uploadErrors:document.querySelectorAll('.gem-attachment-loading-error').length,frames:!!window.__shot2aiBackgroundFrames})):null;
  const userImages=await gemini.locator('user-query').last().locator('img').count();
  if(!error && userImages!==1)error=`Expected exactly one image in the latest Gemini user message, found ${userImages}`;
  const result={run:run+1,error,geminiActivated:foregrounded,userCount,userImages,diagnostics,card:await card.innerText(),geminiUrl:gemini.url()};
  await source.screenshot({path:join(output,`source-${run+1}.png`)});
  report.runs.push(result);publish();console.log(JSON.stringify(result));
  if(error||foregrounded)throw new Error(error || 'Gemini became active');
  if(process.env.SHOT2AI_LIVE_FOLLOWUP){
   const conversation=gemini.url();
   await card.getByRole('button',{name:'Chat in this card',exact:true}).click();
   const input=card.getByLabel('Follow-up message',{exact:true});
   await input.fill('What were the first two words of the heading in my screenshot? Reply with those two words only.');
   await input.press('Enter');
   await expect(input).toBeDisabled();
   await expect(card.locator('.a-status')).toHaveText('Gemini answered',{timeout:110000});
   await expect(input).toHaveValue('');
   await expect(card.locator('.a-body .a-turn')).toHaveCount(1);
   await expect(gemini.locator('user-query')).toHaveCount(userCount+1);
   await expect(gemini.locator('user-query').last().locator('img')).toHaveCount(0);
   expect(gemini.url()).toBe(conversation);
   await expect(card.locator('.a-body')).toContainText('SHOT2AI LIVE');
   if(foregrounded)throw new Error('Gemini became active during follow-up');
   report.followup={passed:true,geminiActivated:foregrounded,url:conversation,text:await card.locator('.a-body').innerText()};publish();
   await source.screenshot({path:join(output,'followup.png')});
  }
  await card.getByRole('button',{name:'Close',exact:true}).click();
 }
 report.phase='passed';publish();
}catch(e){report.phase=report.phase==='login'?'login-unavailable':'failed';report.error=String(e);publish();for(const [i,p] of context.pages().entries()){if(!p.url().includes('accounts.google.com'))await p.screenshot({path:join(output,`failure-${i}.png`)}).catch(()=>{});}process.exitCode=1;}
finally{
 if(traced)await context.tracing.stop({path:join(output,'trace.zip')});
 if(installedId){const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Extensions.uninstall',{id:installedId}).catch(()=>{});await cdp.detach();}
 await context.close();server.close();console.log(`REPORT: ${output}/result.json`);
}
