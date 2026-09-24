import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import gemini from '../src/sites/gemini.js';
import { installGeminiPicker } from './mock-gemini-picker.mjs';
async function setup(page, options={}) {
  await page.setContent('<main></main>');await page.evaluate(installGeminiPicker,options);
  await page.addScriptTag({path:fileURLToPath(new URL('../src/picker.js',import.meta.url))});
}
const read=p=>p.evaluate(m=>window.__shot2aiPicker.read(m),gemini.model);
const choose=(p,w)=>p.evaluate(({m,w})=>window.__shot2aiPicker.choose(m,w),{m:gemini.model,w});
const effort=(p,w)=>p.evaluate(({m,w})=>window.__shot2aiPicker.chooseEffort(m,w),{m:gemini.model,w});
test('Gemini: false haspopup items are models; thinking choices are separate',async({page})=>{
  await setup(page);
  expect(await read(page)).toEqual({ok:true,names:['3.5 Flash-Lite'],current:'3.5 Flash-Lite'});
  expect(await choose(page,'3.5 Flash-Lite')).toMatchObject({ok:true,name:'3.5 Flash-Lite'});
  expect(await choose(page,'Fast')).toMatchObject({ok:false,reason:'modelMissing',names:['3.5 Flash-Lite']});
  expect(await page.evaluate(()=>window.geminiPicker.events)).toEqual([]);
  await expect(page.locator('gem-menu')).toHaveCount(0);
});
test('Gemini: Standard and High thinking are verified independently of model selection',async({page})=>{
  await setup(page);
  expect(await effort(page,'high')).toEqual({ok:true,name:'High thinking'});
  expect(await read(page)).toEqual({ok:true,names:['3.5 Flash-Lite'],current:'3.5 Flash-Lite'});
  expect(await effort(page,'standard')).toEqual({ok:true,name:'Standard thinking'});
  expect(await page.evaluate(()=>window.geminiPicker.events)).toEqual(['effort:High thinking','effort:Standard thinking']);
});
test('Gemini: ignored thinking changes are refused',async({page})=>{
  await setup(page,{stuck:true});
  expect(await effort(page,'high')).toEqual({ok:false,reason:'effortNotSet'});
  await expect(page.locator('gem-menu')).toHaveCount(0);
});
