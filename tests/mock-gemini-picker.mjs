export function installGeminiPicker({ stuck = false } = {}) {
  document.querySelector('[data-test-id="bard-mode-menu-button"]')?.remove();
  const state=window.geminiPicker={model:'3.5 Flash-Lite',effort:'Standard thinking',events:[]};
  let trigger=document.createElement('button');trigger.type='button';trigger.dataset.testId='bard-mode-menu-button';
  trigger.textContent='Flash-Lite';trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-controls','gem-mode-menu');
  (document.querySelector('.input-area-container')||document.body).append(trigger);
  const close=()=>{document.getElementById('gem-mode-menu')?.remove();trigger.setAttribute('aria-expanded','false');};
  const open=()=>{
    if(document.getElementById('gem-mode-menu')){close();return;}
    trigger.setAttribute('aria-expanded','true');
    const menu=document.createElement('gem-menu');menu.id='gem-mode-menu';menu.dataset.testId='gem-mode-menu';menu.dataset.visible='true';menu.setAttribute('role','menu');
    menu.style.cssText='display:block;position:fixed;top:30px;left:20px;width:240px;background:white;z-index:999';
    for(const [name,kind,detail] of [['3.5 Flash-Lite','model','Fastest answers'],['Standard thinking','effort','Quick everyday help'],['High thinking','effort','Complex problem solving']]){
      const item=document.createElement('gem-menu-item');item.style.display='block';item.setAttribute('role','menuitem');item.setAttribute('aria-haspopup','false');
      if(kind==='model')item.dataset.modeId='flash-lite';
      item.classList.toggle('selected',state[kind]===name);
      item.innerHTML='<div class="label"></div><div class="sublabel"></div>';
      item.querySelector('.label').textContent=name;item.querySelector('.sublabel').textContent=detail;
      item.addEventListener('click',()=>{
        state.events.push(`${kind}:${name}`);if(!stuck)state[kind]=name;
        if(kind==='effort'){
          for(const option of menu.querySelectorAll('gem-menu-item')) option.classList.toggle('selected',option.hasAttribute('data-mode-id')||option.querySelector('.label').textContent===state.effort);
          const replacement=trigger.cloneNode(true);
          for(const attr of ['data-test-id','aria-haspopup','aria-controls','aria-expanded'])replacement.removeAttribute(attr);
          replacement.setAttribute('aria-label',`Open mode picker, currently Flash-Lite ${state.effort}`);
          trigger.replaceWith(replacement);trigger=replacement;trigger.addEventListener('click',open);
        }else close();
      });
      menu.append(item);
    }
    document.body.append(menu);
  };
  trigger.addEventListener('click',open);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
}
