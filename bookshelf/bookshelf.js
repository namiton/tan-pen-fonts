/* Ponzu Bunko bookshelf — original CSS 3D cuboid, no runtime dependencies. */
(()=>{'use strict';
const BASE='https://namiton.github.io/tan-pen-fonts/bookshelf/';
const isListing=()=>document.body.matches('.page-index,.page-archive')||location.pathname==='/'||/^\/(archive|search)(\/|$)/.test(location.pathname);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const clean=text=>(text||'').replace(/\s+/g,' ').trim();
const prefs=()=>{try{return JSON.parse(localStorage.getItem('tanpen-reader-settings-v1'))||{}}catch{return {}}};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let cardNumber=0;
function compactCount(n){if(n===null||!Number.isFinite(n))return '—';if(n>=999950)return (n/1000000).toFixed(1)+'m';if(n>=1000)return (n/1000).toFixed(1)+'k';return String(n)}
function starTotal(entry){let total=0;const groups=[entry.stars||[],...(entry.colored_stars||[]).map(group=>group.stars||[])];for(const stars of groups){if(!Array.isArray(stars))throw Error('Invalid star list');for(const star of stars){if(typeof star!=='number'&&(!star||typeof star!=='object'))throw Error('Invalid star');const count=typeof star==='number'?star:(star.count===undefined?1:star.count);if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid star count');total+=count}}if(!Number.isSafeInteger(total))throw Error('Invalid star total');return total}
function paintStars(item,count){
 const metric=item.card.querySelector('.pz-star-total'),number=metric.querySelector('.pz-star-number');number.textContent=compactCount(count);
 const description=count===null?'はてなスター数を取得できませんでした':'公開はてなスター '+count.toLocaleString('ja-JP')+'個';metric.title=description;metric.setAttribute('aria-label',description);metric.dataset.state=count===null?'unavailable':'ready';
}
async function loadStars(items){
 const queue=[],ttl=300000;
 for(const item of items){let cached;try{cached=JSON.parse(sessionStorage.getItem('ponzu-stars-v1:'+item.url))}catch{}if(cached&&Date.now()-cached.at<ttl&&Number.isSafeInteger(cached.count)&&cached.count>=0)paintStars(item,cached.count);else queue.push(item)}
 for(let start=0;start<queue.length;start+=10){
  const batch=queue.slice(start,start+10),url=new URL('https://s.hatena.ne.jp/entries.json');batch.forEach(item=>url.searchParams.append('uri',item.url));
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch(url,{credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('Star API unavailable');const data=await response.json();if(data.error||!Array.isArray(data.entries))throw Error('Invalid star response');
   const counts=new Map();for(const entry of data.entries){if(typeof entry.uri!=='string')throw Error('Invalid star URL');counts.set(new URL(entry.uri).href,starTotal(entry))}
   for(const item of batch){const count=counts.get(item.url)??0;paintStars(item,count);try{sessionStorage.setItem('ponzu-stars-v1:'+item.url,JSON.stringify({count,at:Date.now()}))}catch{}}
  }catch{batch.forEach(item=>paintStars(item,null))}finally{clearTimeout(timeout)}
 }
}
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
  const parsedDate=new Date(date),dateText=Number.isFinite(parsedDate.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(parsedDate).replaceAll('-','.'):(/\d{4}-\d{2}-\d{2}/.exec(date)?.[0]?.replaceAll('-','.')||'');
  const firstParagraph=source.querySelector('.entry-content p,.entry-description,.archive-entry-body');
  const synopsis=clean(settings.synopsis||source.dataset.bookSynopsis||firstParagraph?.textContent).slice(0,110);

  items.push({source,url:url.href,title,date:dateText,series:clean(settings.series||source.dataset.bookSeries||'短編日記'),synopsis});
 }
 return items;
}
function interact(link,book){
 const initial={x:0,y:0};let x=initial.x,y=initial.y,drag=null,blockClick=false,resetTimer;
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
 const loseFocus=()=>{if(drag){const id=drag.id;drag=null;blockClick=true;if(link.hasPointerCapture(id))link.releasePointerCapture(id)}restore()};
 window.addEventListener('blur',loseFocus);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus()});
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
 frontPanel.append(el('span','pz-cover-series',item.series),el('span','pz-cover-title',item.title),el('span','pz-cover-date',item.date),el('span','pz-cover-imprint','ポンズ文庫'));
 backPanel.append(el('span','pz-back-label','あらすじ'),el('span','pz-back-copy',item.synopsis||'日常のすぐ隣にある、小さな物語。'),el('span','pz-back-imprint','ポンズ文庫'));
 front.append(frontPanel);back.append(backPanel);
 spine.append(el('span','pz-spine-series','ポンズ文庫'),el('span','pz-spine-title',item.title),el('span','pz-spine-date',item.date.replace('.',String.fromCharCode(10))));
 book.append(front,back,spine,el('span','pz-face pz-foreedge'),el('span','pz-face pz-top'),el('span','pz-face pz-bottom'));stage.append(book);link.append(stage);
 const caption=el('span','pz-book-caption'),name=el('span','pz-book-title',item.title),metric=el('span','pz-star-total'),number=el('span','pz-star-number','—');name.title=item.title;
 metric.id='pz-star-'+(++cardNumber);metric.dataset.state='loading';metric.setAttribute('aria-label','はてなスター数を取得中');link.setAttribute('aria-describedby',metric.id);
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('class','pz-star-icon');icon.setAttribute('aria-hidden','true');path.setAttribute('d','m12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91L12 3Z');icon.append(path);metric.append(icon,number);caption.append(name,metric);link.append(caption);
 li.append(link);interact(link,book);return li;
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
 const header=el('div','pz-shelf-header'),intro=el('div','pz-shelf-intro');intro.append(el('h2','pz-shelf-heading','ポンズ文庫'));header.append(intro,themeMenu());shelf.append(header);
 if(items.length){const grid=el('ul','pz-shelf-grid');items.forEach(item=>{item.card=card(item);grid.append(item.card)});shelf.append(grid)}else{shelf.append(el('p','pz-shelf-empty','最初の一冊を、準備しています。'))}
 const heading=main.querySelector('.archive-heading');if(heading)heading.after(shelf);else main.prepend(shelf);
 items.forEach(item=>{item.source.dataset.pzSource='true';item.source.hidden=true});
 if(!items.length){for(const node of main.querySelectorAll('.entry,.no-entries,h1,h2,p')){if(node.closest('.pz-bookshelf'))continue;const text=clean(node.textContent);if(text==='まだ記事がありません'||(node.matches('.entry')&&!node.querySelector('.entry-title a[href]')&&text.includes('はてなブログへようこそ'))){node.dataset.pzSource='true';node.hidden=true}}}
 document.body.classList.add('pz-shelf-active');
 loadStars(items);
}
if(!isListing())return;
const css=el('link');css.rel='stylesheet';css.href=BASE+'bookshelf-v7.css';css.onload=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot()};document.head.append(css);
})();
