'use strict';
(() => {
  const qs=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
  const studio=window.PaperStudio;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exhibits=[
    {id:'ZL-001',title:'春在纸间',original:'Chinese Paper Cutting.png',file:'assets/spring.webp',author:'Lanneixi',date:'2022-12-06',category:'character',description:'一个“春”字与周围花叶相互连缀。观察笔画如何成为构图的一部分，再把目光移向文字外侧的镂空。',summary:'文字与花叶相连，读一个纸上的“春”。',source:'https://commons.wikimedia.org/wiki/File:Chinese_Paper_Cutting.png',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'},
    {id:'ZL-002',title:'百福入画',original:'100 Fu (a papercut).JPG',file:'assets/fu.webp',author:'Patricia BjaalandWelch',date:'2006-01-15',category:'character',description:'来源描述为包含一百个“福”字的中国剪纸图像。放大后比较不同字形与排列方式，看看重复如何形成丰富的整体。',summary:'同一个字，排列出不同的节奏。',source:'https://commons.wikimedia.org/wiki/File:100_Fu_(a_papercut).JPG',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/'},
    {id:'ZL-003',title:'节令里的红',original:'Chinese paper cuttings.jpg',file:'assets/festival.webp',author:'ProjectManhattan',date:'2014-01-15',category:'life',description:'照片记录了带有新年吉祥文字的中国剪纸。把观看范围从一件图案扩大到多件并置，观察文字、图案和节令装饰之间的联系。',summary:'从一件图样，看到节令生活的表达。',source:'https://commons.wikimedia.org/wiki/File:Chinese_paper_cuttings.jpg',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/'}
  ];
  let filter='all',current=0,zoom=1,pan={x:0,y:0},drag=null;
  function renderExhibits(){
    const grid=qs('#exhibit-grid');grid.replaceChildren();
    const items=exhibits.filter(e=>filter==='all'||e.category===filter);
    qs('.exhibit-toolbar>p span').textContent=String(items.length).padStart(2,'0')+' 件图录';
    for(const exhibit of items){
      const card=document.createElement('article');card.className='exhibit-card revealed';
      const picture=document.createElement('button');picture.className='exhibit-picture';picture.setAttribute('aria-label','查看图录：'+exhibit.title);
      const img=document.createElement('img');img.src=exhibit.file;img.alt=exhibit.summary;img.loading='lazy';img.decoding='async';picture.append(img);
      picture.addEventListener('click',()=>openExhibit(exhibits.indexOf(exhibit)));
      const info=document.createElement('div');info.innerHTML=`<p class="exhibit-number">${exhibit.id} / 中国剪纸对照</p><h3>${exhibit.title}</h3><p class="exhibit-summary">${exhibit.summary}</p><span class="exhibit-credit">${exhibit.author}<br><a href="${exhibit.source}" target="_blank" rel="noopener">来源</a> · <a href="${exhibit.licenseUrl}" target="_blank" rel="noopener">${exhibit.license}</a> · 尺寸及格式调整</span>`;
      card.append(picture,info);grid.append(card);
    }
  }
  all('[data-exhibit-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.exhibitFilter;all('[data-exhibit-filter]').forEach(x=>x.setAttribute('aria-pressed',x===b));renderExhibits();}));
  function updateZoom(){qs('#exhibit-large').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;qs('#zoom-label').textContent=Math.round(zoom*100)+'%';}
  function resetZoom(){zoom=1;pan={x:0,y:0};updateZoom();}
  function openExhibit(index){
    current=(index+exhibits.length)%exhibits.length;const e=exhibits[current];
    qs('#exhibit-large').src=e.file;qs('#exhibit-large').alt=e.summary;
    qs('#exhibit-index').textContent=e.id+' / 中国剪纸对照资料';qs('#exhibit-title').textContent=e.title;
    qs('#exhibit-description').textContent=e.description;
    qs('#exhibit-metadata').replaceChildren();
    for(const [key,value] of [['原文件名',e.original],['署名',e.author],['图像日期',e.date],['许可',e.license]]){
      const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;div.append(dt,dd);qs('#exhibit-metadata').append(div);
    }
    qs('#exhibit-source').href=e.source;qs('#exhibit-license').href=e.licenseUrl;resetZoom();
    if(!qs('#exhibit-dialog').open)qs('#exhibit-dialog').showModal();
  }
  qs('#exhibit-prev').addEventListener('click',()=>openExhibit(current-1));qs('#exhibit-next').addEventListener('click',()=>openExhibit(current+1));
  qs('#zoom-in').addEventListener('click',()=>{zoom=Math.min(3.5,zoom+.25);updateZoom();});
  qs('#zoom-out').addEventListener('click',()=>{zoom=Math.max(.75,zoom-.25);updateZoom();});qs('#zoom-reset').addEventListener('click',resetZoom);
  const imageStage=qs('.exhibit-image-stage');
  imageStage.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.75,Math.min(3.5,zoom-e.deltaY*.0015));updateZoom();},{passive:false});
  imageStage.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;drag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};imageStage.setPointerCapture(e.pointerId);});
  imageStage.addEventListener('pointermove',e=>{if(!drag)return;pan.x=Math.max(-350,Math.min(350,drag.px+e.clientX-drag.x));pan.y=Math.max(-350,Math.min(350,drag.py+e.clientY-drag.y));updateZoom();});
  imageStage.addEventListener('pointerup',()=>{drag=null;});imageStage.addEventListener('pointercancel',()=>{drag=null;});
  qs('#exhibit-dialog').addEventListener('keydown',e=>{if(e.key==='ArrowRight')openExhibit(current+1);if(e.key==='ArrowLeft')openExhibit(current-1);});
  renderExhibits();

  // Lighting follows the hand, while the SVG's coordinates remain stable.
  const wrap=qs('.canvas-wrap'),paper=qs('#paper'),bench=qs('.workbench');let lastPoint={x:420,y:380};
  paper.addEventListener('pointermove',e=>{
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(paper.getScreenCTM().inverse());lastPoint=p;
    qs('#cut-cursor').style.left=p.x/6+'%';qs('#cut-cursor').style.top=p.y/6+'%';qs('#cut-cursor').style.opacity='1';
    if(!reduced){bench.style.setProperty('--shadow-x',(7+(p.x/600)*13)+'px');bench.style.setProperty('--shadow-y',(10+(p.y/600)*16)+'px');}
  });
  paper.addEventListener('pointerdown',e=>{lastPoint=new DOMPoint(e.clientX,e.clientY).matrixTransform(paper.getScreenCTM().inverse());});
  paper.addEventListener('pointerleave',()=>{qs('#cut-cursor').style.opacity='0';});
  all('[data-worklight]').forEach(b=>b.addEventListener('click',()=>{bench.dataset.light=b.dataset.worklight;all('[data-worklight]').forEach(x=>x.setAttribute('aria-pressed',x===b));}));
  window.addEventListener('paper:cut',()=>{
    const wrap=qs('.canvas-wrap');
    wrap.classList.remove('is-punch');void wrap.offsetWidth;wrap.classList.add('is-punch');
    setTimeout(()=>wrap.classList.remove('is-punch'),100);
    studio.flashStats&&studio.flashStats();
    if(reduced)return;
    const layer=qs('#cut-effects'),color=studio.getData().color;
    const ripple=document.createElement('span');ripple.className='cut-ripple';ripple.style.left=lastPoint.x/6+'%';ripple.style.top=lastPoint.y/6+'%';layer.append(ripple);
    const ring=ripple.animate([{transform:'scale(.3)',opacity:.9},{transform:'scale(2.2)',opacity:0}],{duration:450,easing:'cubic-bezier(.16,1,.3,1)'});ring.onfinish=()=>ripple.remove();
    for(let i=0;i<6;i++){
      const scrap=document.createElement('span');scrap.className='cut-scrap';scrap.style.cssText=`left:${lastPoint.x/6}%;top:${lastPoint.y/6}%;--scrap-color:${color}`;layer.append(scrap);
      const dx=(i-2.5)*18+(Math.random()*8-4),peak=-28-i*4-Math.random()*10,land=55+i*8;
      const a=scrap.animate([
        {transform:'translate(0,0) rotate(0) scale(1)',opacity:.95},
        {transform:`translate(${dx*0.55}px,${peak}px) rotate(${(i-2)*28}deg) scale(1)`,opacity:.9,offset:.38},
        {transform:`translate(${dx}px,${land}px) rotate(${(i-2)*70}deg) scale(.85)`,opacity:0}
      ],{duration:700,easing:'cubic-bezier(.2,.7,.25,1)'});a.onfinish=()=>scrap.remove();
    }
  });

  let modulePromise=null,showcaseScene=null,heroScene=null,sceneVersion=0,showcaseData=null,turning=false;
  const sceneModule=()=>modulePromise||(modulePromise=import('./paper-scene.js'));
  const dialog=qs('#showcase-dialog'),stage=qs('#showcase-stage');
  function flatFallback(d,message){
    const flat=qs('#showcase-fallback');flat.hidden=false;flat.replaceChildren(studio.makeSVG(d,{id:'showcase-flat'}));
    qs('#showcase-hint').textContent=message||'当前设备使用平面光影预览；可以继续收藏和导出。';
    qs('#showcase-turn').disabled=true;qs('#showcase-reset').disabled=true;
    all('[data-scene-light]').forEach(b=>b.disabled=true);qs('#showcase-loading').hidden=true;
  }
  let showcaseOpenedOnce=false;
  async function openShowcase(d){
    const version=++sceneVersion;showcaseData=structuredClone(d);showcaseScene?.dispose();showcaseScene=null;turning=false;
    qs('#showcase-turn').setAttribute('aria-pressed','false');qs('#showcase-turn').disabled=false;qs('#showcase-reset').disabled=false;
    all('[data-scene-light]').forEach(b=>{b.disabled=false;b.setAttribute('aria-pressed',b.dataset.sceneLight==='warm');});
    qs('#showcase-fallback').hidden=true;qs('#showcase-fallback').replaceChildren();
    qs('#showcase-number').textContent=`${d.cuts.length} 剪 / ${d.fold} 份对称`;
    qs('#showcase-hint').textContent='拖动旋转 · 滚轮缩放 · 观察纸层与镂空投影';qs('#showcase-loading').hidden=false;
    if(!dialog.open)dialog.showModal();
    if(window.__DEMO_RECORD_FLAT){flatFallback(d,'平面光影预览 · 演示录制');return;}
    try {
      const mod=await sceneModule();if(version!==sceneVersion||!dialog.open)return;
      const scene=await mod.createPaperScene(stage,studio.svgText(d),{fold:d.fold,color:d.color,onContextLoss:()=>flatFallback(d,'图形环境已暂停，切换到平面光影预览。')});
      if(version!==sceneVersion||!dialog.open){scene.dispose();return;}
      showcaseScene=scene;qs('#showcase-loading').hidden=true;
      if(!showcaseOpenedOnce){showcaseOpenedOnce=true;try{showcaseScene.replay();}catch(e){}}
    }catch{if(version===sceneVersion&&dialog.open)flatFallback(d);}
  }
  qs('#finish-work').addEventListener('click',()=>{
    const payload=studio.getData();
    const run=()=>openShowcase(payload);
    if(reduced){run();return;}
    // Veil-first: cover → open dialog under opaque veil → reveal (no content jump before animation)
    const VEIL_PEAK_MS=160;   // ~40% of cover hold
    const VEIL_DONE_MS=420;   // full cover+reveal
    document.body.classList.add('is-cutaway');
    dialog.classList.add('cutaway','shot-stage-open');
    document.documentElement.dataset.transitionPhase='cover';
    let opened=false;
    const openUnderVeil=()=>{
      if(opened)return;opened=true;
      document.documentElement.dataset.transitionPhase='swap';
      const finish=()=>{
        document.documentElement.dataset.transitionPhase='reveal';
        setTimeout(()=>{
          document.body.classList.remove('is-cutaway');
          dialog.classList.remove('cutaway');
          delete document.documentElement.dataset.transitionPhase;
        }, VEIL_DONE_MS-VEIL_PEAK_MS);
      };
      try{
        if(typeof document.startViewTransition==='function'){
          const vt=document.startViewTransition(()=>{run();});
          Promise.resolve(vt.finished).catch(()=>{}).finally(finish);
          return;
        }
      }catch(e){}
      run();
      finish();
    };
    setTimeout(openUnderVeil, VEIL_PEAK_MS);
  });
  window.addEventListener('paper:showcase',e=>openShowcase(e.detail));
  dialog.addEventListener('close',()=>{sceneVersion++;showcaseScene?.dispose();showcaseScene=null;});
  all('[data-scene-light]').forEach(b=>b.addEventListener('click',()=>{showcaseScene?.setLight(b.dataset.sceneLight);all('[data-scene-light]').forEach(x=>x.setAttribute('aria-pressed',x===b));}));
  qs('#showcase-replay').addEventListener('click',()=>{if(showcaseScene)showcaseScene.replay();else qs('#showcase-fallback svg')?.animate([{transform:'perspective(700px) rotateY(-80deg) scale(.3)',opacity:.2},{transform:'perspective(700px) rotateY(-16deg) scale(1)',opacity:1}],{duration:reduced?1:1500,easing:'cubic-bezier(.16,1,.3,1)'});});
  qs('#showcase-turn').addEventListener('click',()=>{turning=!turning;showcaseScene?.setTurning(turning);qs('#showcase-turn').setAttribute('aria-pressed',turning);});
  qs('#showcase-reset').addEventListener('click',()=>{showcaseScene?.reset();turning=false;qs('#showcase-turn').setAttribute('aria-pressed','false');});
  qs('#showcase-back').addEventListener('click',()=>dialog.close());
  qs('#showcase-save').addEventListener('click',()=>{if(showcaseData)studio.loadData(showcaseData);qs('#save').click();dialog.close();if(window.JinlingShots&&window.JinlingShots.goto){window.JinlingShots.resume&&window.JinlingShots.resume();window.JinlingShots.goto('gallery');}else qs('#gallery').scrollIntoView({behavior:reduced?'instant':'smooth'});});

  async function startHero(){
    const art=qs('#hero-art').cloneNode(true);art.querySelectorAll('circle[r="272"]').forEach(e=>e.remove());art.setAttribute('xmlns','http://www.w3.org/2000/svg');
    try {
      const mod=await sceneModule();heroScene=await mod.createPaperScene(qs('#hero-3d'),new XMLSerializer().serializeToString(art),{hero:true,fold:8,onContextLoss:()=>{qs('.art-frame').classList.remove('has-webgl');qs('#hero-render-note').textContent='纸层光影 · 原创数字习作';}});
      qs('.art-frame').classList.add('has-webgl');
    }catch{qs('#hero-render-note').textContent='纸层光影 · 原创数字习作';}
  }
  if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){observer.disconnect();startHero();}},{rootMargin:'100px'});observer.observe(qs('#hero-3d'));}else startHero();
  window.addEventListener('pagehide',()=>{heroScene?.dispose();showcaseScene?.dispose();});

  // ---- Cinematic boot: AI inspire, title-card, chapters, studio guide ----
  (function cinematicBoot(){
    const chips=qs('.ai-chips');
    const moreBtn=qs('#ai-chips-more');
    if(chips && window.AiInspire){
      chips.dataset.collapsed='true';
      AiInspire.CHIP_PRESETS.forEach((c,i)=>{
        const b=document.createElement('button');
        b.type='button';b.textContent=c.label;b.dataset.prompt=c.prompt;
        b.addEventListener('click',()=>{
          chips.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));
          b.setAttribute('aria-pressed','true');
          qs('#ai-prompt').value=c.prompt;
        });
        chips.append(b);
      });
      if(moreBtn){
        moreBtn.hidden = AiInspire.CHIP_PRESETS.length <= 3;
        moreBtn.addEventListener('click',()=>{
          const collapsed = chips.dataset.collapsed !== 'false';
          chips.dataset.collapsed = collapsed ? 'false' : 'true';
          moreBtn.textContent = collapsed ? '收起' : '更多';
        });
      }
    }
    let aiBusy=false;
    async function runAiInspire(){
      if(!window.AiInspire||aiBusy)return;
      const prompt=(qs('#ai-prompt').value||'').trim()||'团花';
      const panel=qs('#ai-inspire'), go=qs('#ai-generate'), statusEl=qs('#ai-status');
      aiBusy=true;panel.classList.add('is-thinking');go.classList.add('is-waiting');go.textContent='起稿中…';
      statusEl.textContent='本地规则引擎正在推演对称轮廓…';
      const result=AiInspire.generateGuides(prompt,{fold:studio.getData().fold,color:studio.getData().color});
      const wait=reduced?0:result.waitMs;
      await new Promise(r=>setTimeout(r,wait));
      const applied=studio.applyAiOutline(result.outline,result.fold);
      studio.setAiGuides(result.guides,{prompt:result.prompt,seed:result.seed,engine:result.engine});
      requestAnimationFrame(()=>{
        const g=[...qs('#paper').querySelectorAll('g')].find(el=>el.getAttribute('class')==='ai-guide-layer');
        const wrap=qs('.canvas-wrap');
        if(wrap&&!reduced){
          wrap.classList.remove('is-ai-push');void wrap.offsetWidth;wrap.classList.add('is-ai-push');
          setTimeout(()=>wrap.classList.remove('is-ai-push'),1600);
        }
        if(g&&!reduced){
          g.classList.add('is-arriving');
          [...g.querySelectorAll('path')].forEach((p,i)=>{
            let len=120;
            try{len=Math.max(40,p.getTotalLength());}catch(e){}
            p.style.strokeDasharray=String(len);
            p.style.strokeDashoffset=String(len);
            p.style.animationDelay=(i*60)+'ms';
            // force reflow then grow
            void p.getBoundingClientRect();
            p.style.transition=`stroke-dashoffset 1.35s cubic-bezier(.16,1,.3,1) ${i*60}ms, opacity .4s ease ${i*40}ms`;
            p.style.opacity='0.2';
            requestAnimationFrame(()=>{p.style.strokeDashoffset='0';p.style.opacity='1';});
          });
          setTimeout(()=>{
            g.classList.remove('is-arriving');
            [...g.querySelectorAll('path')].forEach(p=>{p.style.transition='';p.style.animationDelay='';});
          },1600);
        }
      });
      const seedShort='···'+String(result.seed).slice(-3);
      let msg='已生成 '+result.guides.length+' 条虚线 · 种子 '+seedShort+' · 本地规则';
      if(applied&&applied.foldSkipped) msg+=' · 已有剪口，对称未改';
      statusEl.textContent=msg;
      studio.status(applied&&applied.foldSkipped?'AI 轮廓已就位（对称保持原样）· 请沿虚线落剪':'AI 轮廓已就位 · 请用人手落下第一剪');
      panel.classList.remove('is-thinking');go.classList.remove('is-waiting');go.textContent='AI 起稿轮廓';aiBusy=false;
    }
    qs('#ai-generate')&&qs('#ai-generate').addEventListener('click',runAiInspire);
    qs('#ai-prompt')&&qs('#ai-prompt').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runAiInspire();}});
    qs('#ai-clear-guides')&&qs('#ai-clear-guides').addEventListener('click',()=>{studio.clearAiGuides();qs('#ai-status').textContent='建议轮廓已清除。';studio.status('已清除 AI 建议轮廓。');});
    qs('#ai-hand-continue')&&qs('#ai-hand-continue').addEventListener('click',()=>{
      qs('#paper').focus();
      studio.status('轮廓保留作参考 · 选择剪口后在纸面落剪');
      qs('#ai-status').textContent='请沿虚线建议落剪；不满意可再起一稿或清除轮廓。';
    });

    function playGuideArrival(){
      requestAnimationFrame(()=>{
        const g=[...qs('#paper').querySelectorAll('g')].find(el=>el.getAttribute('class')==='ai-guide-layer');
        const wrap=qs('.canvas-wrap');
        if(wrap&&!reduced){
          wrap.classList.remove('is-ai-push');void wrap.offsetWidth;wrap.classList.add('is-ai-push');
          setTimeout(()=>wrap.classList.remove('is-ai-push'),1600);
        }
        if(g&&!reduced){
          g.classList.add('is-arriving');
          [...g.querySelectorAll('path')].forEach((p,i)=>{
            let len=120;
            try{len=Math.max(40,p.getTotalLength());}catch(e){}
            p.style.strokeDasharray=String(len);
            p.style.strokeDashoffset=String(len);
            p.style.animationDelay=(i*60)+'ms';
            void p.getBoundingClientRect();
            p.style.transition=`stroke-dashoffset 1.35s cubic-bezier(.16,1,.3,1) ${i*60}ms, opacity .4s ease ${i*40}ms`;
            p.style.opacity='0.2';
            requestAnimationFrame(()=>{p.style.strokeDashoffset='0';p.style.opacity='1';});
          });
          setTimeout(()=>{
            g.classList.remove('is-arriving');
            [...g.querySelectorAll('path')].forEach(p=>{p.style.transition='';p.style.animationDelay='';});
          },1600);
        }
      });
    }
    function setAiMode(mode){
      const word=mode!=='photo';
      qs('#ai-tab-word')&&qs('#ai-tab-word').classList.toggle('is-active',word);
      qs('#ai-tab-photo')&&qs('#ai-tab-photo').classList.toggle('is-active',!word);
      qs('#ai-tab-word')&&qs('#ai-tab-word').setAttribute('aria-selected',word?'true':'false');
      qs('#ai-tab-photo')&&qs('#ai-tab-photo').setAttribute('aria-selected',word?'false':'true');
      const paneW=qs('#ai-pane-word'), paneP=qs('#ai-pane-photo'), hint=qs('#ai-mode-hint'), statusEl=qs('#ai-status');
      if(paneW) paneW.hidden=!word;
      if(paneP) paneP.hidden=word;
      if(hint){
        hint.innerHTML=word
          ? '短词或芯片 → 虚线建议轮廓；剪口仍由你落下。<strong class="ai-honest">本地规则起稿，非云端大模型。</strong>'
          : '上传剪影/单主体图 → 本地轮廓建议；剪口仍由你落下。<strong class="ai-honest">照片未上传 / 仅本机处理。</strong>';
      }
      if(statusEl){
        statusEl.textContent=word?'等待一句灵感。':'照片未上传 / 仅本机处理';
      }
    }
    qs('#ai-tab-word')&&qs('#ai-tab-word').addEventListener('click',()=>setAiMode('word'));
    qs('#ai-tab-photo')&&qs('#ai-tab-photo').addEventListener('click',()=>setAiMode('photo'));
    let photoFile=null;
    qs('#ai-photo-input')&&qs('#ai-photo-input').addEventListener('change',(e)=>{
      const f=e.target.files&&e.target.files[0];
      photoFile=f||null;
      const thumb=qs('#ai-photo-thumb');
      if(thumb&&thumb.dataset.url){try{URL.revokeObjectURL(thumb.dataset.url);}catch(err){}}
      if(f&&thumb){
        const url=URL.createObjectURL(f);
        thumb.dataset.url=url;thumb.src=url;thumb.hidden=false;
        qs('#ai-status').textContent='已选图 · 仅本机处理 · 未上传';
      }else if(thumb){
        thumb.hidden=true;thumb.removeAttribute('src');delete thumb.dataset.url;
        qs('#ai-status').textContent='照片未上传 / 仅本机处理';
      }
    });
    qs('#ai-photo-threshold')&&qs('#ai-photo-threshold').addEventListener('input',(e)=>{
      const v=+e.target.value;
      qs('#ai-photo-threshold-value').textContent=v===0?'自动':String(v);
    });
    async function runPhotoInspire(){
      if(!window.PhotoPapercut||aiBusy)return;
      const panel=qs('#ai-inspire'), go=qs('#ai-photo-generate'), statusEl=qs('#ai-status');
      if(!photoFile){
        statusEl.textContent='请先选择图片，或改用词灵感芯片。';
        return;
      }
      aiBusy=true;panel.classList.add('is-thinking');
      if(go){go.classList.add('is-waiting');go.textContent='处理中…';}
      statusEl.textContent='本地图像处理中（未上传）…';
      const thrEl=qs('#ai-photo-threshold');
      const thrRaw=thrEl?+thrEl.value:0;
      const opts={};
      if(thrRaw>0) opts.threshold=thrRaw;
      let result;
      try{
        result=await PhotoPapercut.fromFile(photoFile,opts);
      }catch(err){
        result={guides:[],error:(err&&err.message)||'处理失败'};
      }
      if(!result||!result.guides||!result.guides.length){
        statusEl.textContent=(result&&result.error)||'未找到有效轮廓 · 请换图或改用词灵感';
        studio.status('照片起稿未成功 · 可切回词灵感');
        panel.classList.remove('is-thinking');
        if(go){go.classList.remove('is-waiting');go.textContent='生成建议轮廓';}
        aiBusy=false;
        return;
      }
      const meta=result.meta||{};
      const applied=studio.applyAiOutline('round');
      studio.setAiGuides(result.guides,meta);
      playGuideArrival();
      let msg='已生成 '+result.guides.length+' 条轮廓 · 本地图像处理 · 未上传';
      if(applied&&applied.foldSkipped) msg+=' · 已有剪口，对称未改';
      statusEl.textContent=msg;
      studio.status(applied&&applied.foldSkipped?'照片轮廓已就位（对称保持）· 请沿虚线落剪':'照片轮廓已就位 · 请用人手落下第一剪');
      panel.classList.remove('is-thinking');
      if(go){go.classList.remove('is-waiting');go.textContent='生成建议轮廓';}
      aiBusy=false;
    }
    qs('#ai-photo-generate')&&qs('#ai-photo-generate').addEventListener('click',runPhotoInspire);

    const titleCard=qs('#title-card');
    const startBtn=qs('#start-presentation');
    const closeCard=qs('#close-card');
    function playTitle(){
      titleCard.classList.remove('is-playing');void titleCard.offsetWidth;
      if(!reduced) titleCard.classList.add('is-playing');
    }
    startBtn&&startBtn.addEventListener('click',()=>{
      queueMicrotask(()=>{ if(!titleCard.hidden) playTitle(); });
    });
    closeCard&&closeCard.addEventListener('click',()=>{
      titleCard.classList.remove('is-playing');
      const hero=qs('.hero');
      hero.classList.remove('is-revealed');void hero.offsetWidth;
      hero.classList.add('is-revealed');
      if(!reduced) qs('.hero-visual').classList.add('is-drifting');
      if(window.JinlingShots&&window.JinlingShots.goto) window.JinlingShots.goto('hero',{instant:true,skipCard:true});
    });
    requestAnimationFrame(()=>{
      if(titleCard.hidden){
        qs('.hero').classList.add('is-revealed');
        if(!reduced) qs('.hero-visual').classList.add('is-drifting');
      }
    });

    const chapters=[
      {el:qs('#heritage')},
      {el:qs('#exhibits'), dark:true},
      {el:qs('#studio')},
      {el:qs('#gallery')},
      {el:qs('#closing')||qs('.closing')}
    ].filter(c=>c.el);
    chapters.forEach(c=>c.el.classList.add('stage-ready'));
    const header=qs('.header');
    function onShotEnter(ev){
      const id=ev.detail&&ev.detail.id;
      if(!id)return;
      const el=qs('[data-shot="'+id+'"]');
      if(el){el.classList.add('is-onstage');el.classList.remove('stage-ready');}
      if(id==='exhibits'){
        qs('#exhibits')?.querySelectorAll('.exhibit-card').forEach(card=>card.classList.add('is-stagger'));
        window.JinlingShots&&window.JinlingShots.enableExhibitRail&&window.JinlingShots.enableExhibitRail();
      }
      if(id==='studio'){
        window.JinlingShots&&window.JinlingShots.pause&&window.JinlingShots.pause();
      }
    }
    function onShotLeave(ev){
      const id=ev.detail&&ev.detail.id;
      if(id==='studio'){
        // resume only if cinematic and leaving via controller; controller already resumes on goto
      }
      if(id==='exhibits'){
        window.JinlingShots&&window.JinlingShots.disableExhibitRail&&window.JinlingShots.disableExhibitRail();
      }
    }
    window.addEventListener('shot:enter', onShotEnter);
    window.addEventListener('shot:leave', onShotLeave);
    // Fallback if shots.js unavailable: keep legacy IO (shots.js loads before us when defer-ordered)
    function installLegacyIO(){
      let activeId=null;
      function setActive(id){
        if(activeId===id)return;activeId=id;
        all('.museum-route a').forEach(a=>a.classList.toggle('is-active', a.getAttribute('href')==='#'+id));
        all('.header nav a').forEach(a=>a.classList.toggle('is-active', a.getAttribute('href')==='#'+id));
        header.classList.toggle('on-dark', id==='exhibits');
      }
      if('IntersectionObserver' in window){
        const io=new IntersectionObserver((entries)=>{
          entries.forEach(en=>{
            if(en.isIntersecting){
              en.target.classList.add('is-onstage');
              if(en.target.id==='exhibits'){
                en.target.querySelectorAll('.exhibit-card').forEach(card=>card.classList.add('is-stagger'));
              }
            }
          });
          let best=null,bestRatio=0;
          for(const c of chapters){
            const r=c.el.getBoundingClientRect();
            const vis=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0))/Math.max(r.height,1);
            if(vis>bestRatio){bestRatio=vis;best=c;}
          }
          if(best && bestRatio>0.18) setActive(best.el.id);
        },{threshold:[0.22,0.4,0.6]});
        chapters.forEach(c=>io.observe(c.el));
      } else {
        chapters.forEach(c=>c.el.classList.add('is-onstage'));
      }
    }
    if(!window.JinlingShots){
      const startLegacy=()=>{ if(!window.JinlingShots) installLegacyIO(); };
      window.addEventListener('jinling-shots-ready', ()=>{}, {once:true});
      setTimeout(startLegacy, 0);
    }

    const guide=qs('#studio-guide');
    const steps=[
      {title:'先起一稿轮廓', body:'词灵感芯片，或切到「照片起稿」上传单主体浅底图；本地处理生成虚线建议，剪口仍由人手落下。'},
      {title:'沿轮廓落下剪口', body:'选择剪口形状，在红纸上点击或拖动。每一剪都会对称展开为光隙。'},
      {title:'展开 · 展台 · 收藏', body:'点「展开看看」或「完成作品」进入光影展台，再收藏导出。'}
    ];
    let step=0;
    function showGuide(i){
      step=i;qs('#guide-step-label').textContent=(i+1)+' / 3';
      qs('#guide-title').textContent=steps[i].title;qs('#guide-body').textContent=steps[i].body;
      qs('#guide-next').textContent=i===2?'开始创作':'下一步';
      guide.hidden=false;
    }
    function dismissGuide(){
      guide.hidden=true;
      try{localStorage.setItem('jinling-studio-guide-v1','done');}catch(e){}
    }
    qs('#guide-next')&&qs('#guide-next').addEventListener('click',()=>{ if(step>=2) dismissGuide(); else showGuide(step+1); });
    qs('#guide-skip')&&qs('#guide-skip').addEventListener('click',dismissGuide);
    try{
      if(localStorage.getItem('jinling-studio-guide-v1')!=='done'){
        let guided=false;
        const kick=()=>{if(guided)return;try{if(localStorage.getItem('jinling-studio-guide-v1')==='done')return;}catch(e){}guided=true;showGuide(0);};
        window.addEventListener('shot:enter',(ev)=>{if(ev.detail&&ev.detail.id==='studio')kick();});
        if('IntersectionObserver' in window){
          const studioIo=new IntersectionObserver((ents)=>{
            if(ents[0].isIntersecting){studioIo.disconnect();kick();}
          },{threshold:0.35});
          studioIo.observe(qs('#studio'));
        }
      }
    }catch(e){}
  })();
})();

