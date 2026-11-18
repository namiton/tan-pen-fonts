/* Ponzu Bunko bookshelf — original CSS 3D cuboid, no runtime dependencies. */
(()=>{'use strict';
const BASE='https://namiton.github.io/tan-pen-fonts/bookshelf/';
const isListing=()=>document.body.matches('.page-index,.page-archive')||location.pathname==='/'||/^\/(archive|search)(\/|$)/.test(location.pathname);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const clean=text=>(text||'').replace(/\s+/g,' ').trim();
const prefs=()=>{try{return JSON.parse(localStorage.getItem('tanpen-reader-settings-v1'))||{}}catch{return {}}};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function collect(main){
 const seen=new Set(),items=[];
 for(const source of main.querySelectorAll('article.entry,.hentry,.archive-entry')){
  if(source.closest('[data-pz-source]'))continue;
  const link=source.querySelector('.entry-title a[href],.archive-entry-title a[href]');if(!link)continue;
  let url;try{url=new URL(link.getAttribute('href'),location.href)}catch{continue}
  if(!/^https?:$/.test(url.protocol)||url.origin!==location.origin||!/^\/entry\//.test(url.pathname))continue;
  if(seen.has(url.href))continue;seen.add(url.href);
  const title=clean(link.textContent);if(!title)continue;
  const settings=window.PonzuShelf?.books?.[url.pathname]||{},time=source.querySelector('time'),date=time?.getAttribute('datetime')||clean(source.querySelector('.date,.archive-date,.entry-date')?.textContent);
  const dateText=/\d{4}-\d{2}-\d{2}/.exec(date)?.[0]?.replaceAll('-','.')||'';
  const firstParagraph=source.querySelector('.entry-content p,.entry-description,.archive-entry-body');
  const synopsis=clean(settings.synopsis||source.dataset.bookSynopsis||firstParagraph?.textContent).slice(0,110);
  const episode=clean(settings.episode||source.dataset.bookEpisode||/第[\d０-９一二三四五六七八九十百]+話/.exec(title)?.[0]||'');
  items.push({source,url:url.href,title,date:dateText,episode,series:clean(settings.series||source.dataset.bookSeries||'短編日記'),synopsis});
 }
 return items;
}
function japaneseNumber(n){let result='';for(const [unit,symbol] of [[1000,'千'],[100,'百'],[10,'十'],[1,'']]){const digit=Math.floor(n/unit);n%=unit;if(digit)result+=(digit===1&&unit>1?'':'一二三四五六七八九'[digit-1])+symbol}return result}
async function numberBooks(items){
 if(!items.length)return;
 const cacheKey='ponzu-shelf-order-v1',paths=items.map(item=>new URL(item.url).pathname);let order;
 try{const cache=JSON.parse(sessionStorage.getItem(cacheKey));if(cache&&Date.now()-cache.at<300000&&paths.every(path=>cache.order.includes(path)))order=cache.order}catch{}
 if(!order){
  const newest=[],seen=new Set(),visited=new Set();let url=new URL('/archive',location.origin).href;
  try{
   while(url){
    if(visited.has(url)||visited.size>=100)throw Error('Incomplete archive');visited.add(url);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);let response;
    try{response=await fetch(url,{credentials:'same-origin',signal:controller.signal})}finally{clearTimeout(timeout)}
    if(!response.ok)throw Error('Archive unavailable');
    const doc=new DOMParser().parseFromString(await response.text(),'text/html');
    const pageItems=collect(doc.querySelector('#main-inner,#main')||doc);if(!pageItems.length)throw Error('Archive contains no entries');
    for(const item of pageItems){const path=new URL(item.url).pathname;if(!seen.has(path)){seen.add(path);newest.push(path)}}
    const next=doc.querySelector('.pager-next a[href],a.pager-next[href],.pager a[rel=next]');
    if(next){const candidate=new URL(next.getAttribute('href'),response.url);if(candidate.origin!==location.origin||!/^\/archive(?:\/|$)/.test(candidate.pathname))throw Error('Unexpected archive URL');url=candidate.href}else url=null;
   }
   order=newest.reverse();if(!paths.every(path=>order.includes(path)))return;
   try{sessionStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),order}))}catch{}
  }catch(error){console.warn('Ponzu shelf: episode numbering unavailable; article links remain usable.');return}
 }
 for(const item of items){const n=order.indexOf(new URL(item.url).pathname)+1;if(!n)continue;const label='第'+(n<10000?japaneseNumber(n):n)+'話';for(const node of item.card.querySelectorAll('.pz-cover-episode,.pz-spine-episode'))node.textContent=label}
}
function interact(link,book){
 const initial={x:-7,y:-16};let x=initial.x,y=initial.y,drag=null,blockClick=false,resetTimer;
 const draw=()=>{book.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`};draw();
 function restore(){
  if(drag)return;link.classList.remove('pz-dragging');book.style.transition=reduce?'none':'transform 620ms cubic-bezier(.22,.75,.24,1)';
  // Select the equivalent starting angle nearest to the last rotation. No full-turn snap.
  x=initial.x+360*Math.round((x-initial.x)/360);y=initial.y+360*Math.round((y-initial.y)/360);draw();
 }
 function release(event,cancel=false){
  if(!drag||event.pointerId!==drag.id)return;const moved=drag.moved;drag=null;link.classList.remove('pz-dragging');
  blockClick=moved||cancel;clearTimeout(resetTimer);resetTimer=setTimeout(()=>{blockClick=false},500);
  if(link.hasPointerCapture(event.pointerId))link.releasePointerCapture(event.pointerId);
  const rect=link.getBoundingClientRect();if(cancel||event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)restore();
 }
 link.addEventListener('pointerdown',event=>{
  if(event.pointerType==='touch'||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  clearTimeout(resetTimer);blockClick=false;book.style.transition='none';drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};
  link.setPointerCapture(event.pointerId);event.preventDefault();
 });
 link.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6)return;
  drag.moved=true;link.classList.add('pz-dragging');
  y+=(event.clientX-drag.lastX)*.72;x-=(event.clientY-drag.lastY)*.72;drag.lastX=event.clientX;drag.lastY=event.clientY;draw();
 });
 link.addEventListener('pointerup',event=>release(event));
 link.addEventListener('pointercancel',event=>release(event,true));
 link.addEventListener('lostpointercapture',()=>{if(drag){blockClick=true;drag=null;restore()}});
 link.addEventListener('pointerleave',restore);
 link.addEventListener('blur',restore);
 link.addEventListener('dragstart',event=>event.preventDefault());
 link.addEventListener('click',event=>{if(blockClick){event.preventDefault();event.stopPropagation();blockClick=false}});
 link.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(event.key))return;
  event.preventDefault();if(event.key==='Escape'){restore();return}
  book.style.transition=reduce?'none':'transform 140ms ease-out';
  if(event.key==='ArrowLeft')y-=20;if(event.key==='ArrowRight')y+=20;if(event.key==='ArrowUp')x+=20;if(event.key==='ArrowDown')x-=20;draw();
 });
}
function card(item){
 const li=el('li','pz-shelf-item'),link=el('a','pz-book-link');link.href=item.url;link.draggable=false;link.setAttribute('aria-label',item.title+'を読む');
 const stage=el('span','pz-book-stage'),book=el('span','pz-book');book.setAttribute('aria-hidden','true');
 const front=el('span','pz-face pz-front'),back=el('span','pz-face pz-back'),spine=el('span','pz-face pz-spine');
 const frontPanel=el('span','pz-cover-panel'),backPanel=el('span','pz-cover-panel');
 frontPanel.append(el('span','pz-cover-series',item.series),el('span','pz-cover-title',item.title),el('span','pz-cover-episode',item.episode),el('span','pz-cover-imprint','ポンズ文庫'));
 backPanel.append(el('span','pz-back-label','あらすじ'),el('span','pz-back-copy',item.synopsis||'日常のすぐ隣にある、小さな物語。'),el('span','pz-back-imprint','ポンズ文庫'));
 front.append(frontPanel);back.append(backPanel);
 spine.append(el('span','pz-spine-series','ポンズ文庫'),el('span','pz-spine-title',item.title),el('span','pz-spine-episode',item.episode));
 book.append(front,back,spine,el('span','pz-face pz-foreedge'),el('span','pz-face pz-top'),el('span','pz-face pz-bottom'));stage.append(book);link.append(stage);
 const caption=el('span','pz-book-caption');caption.append(el('span','pz-book-title',item.title));if(item.date)caption.append(el('span','pz-book-date',item.date));link.append(caption);li.append(link);interact(link,book);return li;
}
function themeMenu(){
 const menu=el('details','pz-theme'),summary=el('summary','pz-theme-trigger'),panel=el('div','pz-theme-panel'),buttons={};
 function apply(theme){
  const dark=theme==='dark';document.documentElement.classList.toggle('tp-site-dark',dark);summary.textContent='テーマ：'+(dark?'黒':'白');
  for(const key in buttons)buttons[key].setAttribute('aria-pressed',String(key===theme));
 }
 for(const [key,label] of [['light','白'],['dark','黒']]){const b=el('button','',label);b.type='button';b.setAttribute('aria-label','テーマ '+label);buttons[key]=b;panel.append(b);b.onclick=()=>{apply(key);try{localStorage.setItem('tanpen-reader-settings-v1',JSON.stringify({...prefs(),theme:key}))}catch{}document.dispatchEvent(new CustomEvent('tanpen-reader-theme',{detail:key}));menu.open=false;summary.focus({preventScroll:true})}}
 menu.append(summary,panel);apply(prefs().theme==='dark'?'dark':'light');document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))menu.open=false});menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;summary.focus({preventScroll:true})}});return menu;
}
function boot(){
 if(!isListing()||document.querySelector('.pz-bookshelf'))return;
 const main=document.querySelector('#main-inner')||document.querySelector('#main');if(!main)return;
 if(!CSS.supports('transform-style','preserve-3d'))return;
 const items=collect(main),shelf=el('section','pz-bookshelf');shelf.setAttribute('aria-label','ポンズ文庫の本棚');
 const header=el('div','pz-shelf-header'),intro=el('div','pz-shelf-intro');intro.append(el('h2','pz-shelf-heading','ポンズ文庫'),el('p','pz-shelf-note',matchMedia('(hover:hover)').matches?'ドラッグで回転、クリックで読む':'表紙をタップして読む'));header.append(intro,themeMenu());shelf.append(header);
 if(items.length){const grid=el('ul','pz-shelf-grid');items.forEach(item=>{item.card=card(item);grid.append(item.card)});shelf.append(grid)}else{shelf.append(el('p','pz-shelf-empty','最初の一冊を、準備しています。'))}
 const heading=main.querySelector('.archive-heading');if(heading)heading.after(shelf);else main.prepend(shelf);
 items.forEach(item=>{item.source.dataset.pzSource='true';item.source.hidden=true});
 if(!items.length){for(const node of main.querySelectorAll('.entry,.no-entries,h1,h2,p')){if(node.closest('.pz-bookshelf'))continue;const text=clean(node.textContent);if(text==='まだ記事がありません'||(node.matches('.entry')&&!node.querySelector('.entry-title a[href]')&&text.includes('はてなブログへようこそ'))){node.dataset.pzSource='true';node.hidden=true}}}
 document.body.classList.add('pz-shelf-active');
 numberBooks(items);
}
if(!isListing())return;
const css=el('link');css.rel='stylesheet';css.href=BASE+'bookshelf-v1.css';css.onload=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot()};document.head.append(css);
})();
