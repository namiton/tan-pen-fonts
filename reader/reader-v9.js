/* MIT. StPageFlip: Copyright 2020 Nodlik. Bookmarks stay in this browser. */
(()=>{'use strict';
const BASE='https://namiton.github.io/tan-pen-fonts/reader/';
const split=s=>globalThis.Intl?.Segmenter?[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(s)].map(x=>x.segment):Array.from(s);
const read=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function button(text){const b=el('button','',text);b.type='button';return b}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s)})}
async function mount(source){
 if(source.dataset.tpMounted)return;source.dataset.tpMounted='1';
 const blocks=[...source.children].filter(n=>n.tagName==='P').map(n=>n.innerText.replace(/\r\n?/g,'\n').trim()).filter(Boolean);
 if(!blocks.length||source.querySelector('img,table,video,audio,iframe,pre,ruby'))return;
 const titleNode=source.closest('article')?.querySelector('.entry-title');
 const title=(titleNode?.innerText||document.querySelector('h1')?.innerText||document.title).trim();
 const href=titleNode?.querySelector('a[href]')?.href||document.querySelector('link[rel="canonical"]')?.href||location.href.split('?')[0];
 const bookmarkKey='tanpen-bookmark-v1:'+href,settings=read('tanpen-reader-settings-v1')||{};
 let theme=settings.theme==='dark'?'dark':'light',size=['small','medium','large'].includes(settings.size)?settings.size:'medium';
 let saved=read(bookmarkKey),book=null,pages=[],chunks=[],pageWidth=0,pageHeight=0,single=false,logical=1,total=0,timer,building=false;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const host=el('section','tp-reader');host.setAttribute('aria-label','縦書きの読書ビュー');
 const toolbar=el('div','tp-toolbar'),themeButton=button(''),sizes=el('div','tp-sizes');sizes.setAttribute('role','group');sizes.setAttribute('aria-label','文字サイズ');
 const sizeButtons={};for(const [key,label] of [['small','小'],['medium','中'],['large','大']]){const b=button(label);b.setAttribute('aria-label','文字サイズ '+label);sizes.append(b);sizeButtons[key]=b}
 const saveButton=button('しおりを挟む'),goButton=button('しおりへ戻る'),removeButton=button('しおりを外す');
 const bookmarkTools=el('div','tp-bookmarks');bookmarkTools.setAttribute('role','group');bookmarkTools.setAttribute('aria-label','しおり');bookmarkTools.append(saveButton,goButton,removeButton);toolbar.append(themeButton,sizes,bookmarkTools);
 const stage=el('div','tp-stage'),bookFrame=el('div','tp-book-frame'),ribbon=el('span','tp-bookmark-ribbon'),controls=el('nav','tp-controls');let bookEl=el('div','tp-book');controls.setAttribute('aria-label','ページ操作');
 ribbon.hidden=true;ribbon.setAttribute('role','img');ribbon.setAttribute('aria-label','しおりを挟んだ位置');
 const next=button('次のページ ←'),prev=button('→ 前のページ'),status=el('span','tp-status'),mode=button('通常の文章で読む');mode.className='tp-mode';
 status.setAttribute('aria-live','polite');controls.append(next,status,prev);stage.append(bookEl);bookFrame.append(stage,ribbon);host.append(toolbar,bookFrame,controls,mode);source.before(host);
 function applySettings(){host.dataset.theme=theme;host.dataset.size=size;host.style.setProperty('--tp-font-size',({small:18,medium:20,large:23})[size]+'px');source.classList.toggle('tp-plain-dark',theme==='dark');source.style.setProperty('--tp-plain-size',({small:18,medium:20,large:23})[size]+'px');themeButton.textContent=theme==='dark'?'明るいテーマ':'ダークテーマ';themeButton.setAttribute('aria-label',theme==='dark'?'明るいテーマに切り替える':'ダークテーマに切り替える');for(const key in sizeButtons)sizeButtons[key].setAttribute('aria-pressed',String(size===key))}
 function bookmarkButtons(){const valid=saved&&saved.title===title&&Number.isFinite(saved.offset);goButton.disabled=removeButton.disabled=!valid;goButton.hidden=removeButton.hidden=!valid;saveButton.textContent=valid?'しおりを更新':'しおりを挟む';paintBookmark()}
 function paintBookmark(){const valid=saved&&saved.title===title&&Number.isFinite(saved.offset);if(!book||!valid){ribbon.hidden=true;return}const target=pageFor(saved),last=Math.min(total,logical+(book.getOrientation()==='portrait'?0:1));ribbon.hidden=target<logical||target>last}
 function anchor(){if(logical<=2)return {front:logical};return {offset:chunks[Math.min(chunks.length-1,logical-3)]?.start||0}}
 function pageFor(a){if(a.front)return a.front;const found=chunks.findIndex(c=>a.offset>=c.start&&a.offset<c.end);return found<0?total:found+3}
 function update(){if(!book)return;const i=book.getCurrentPageIndex(),portrait=book.getOrientation()==='portrait';logical=Math.max(1,pages.length-i-(portrait?0:1));const last=Math.min(total,logical+(portrait?0:1));status.textContent=logical<=2?(logical===1?'表紙':'白紙'):`${logical-2}${last>logical?'–'+(last-2):''} / ${total-2}`;next.disabled=last>=total;prev.disabled=logical<=1;paintBookmark()}
 function addPart(parent,part){const p=el('p','',part.text);if(part.continued)p.dataset.continued='true';if(/^[「『（〈《【]/u.test(part.text))p.dataset.dialog='true';parent.append(p);return p}
 function paginate(){
  const measure=el('div','tp-page tp-measure');measure.style.width=pageWidth+'px';measure.style.height=pageHeight+'px';const inner=el('div','tp-page-inner');measure.append(inner);host.append(measure);
  const result=[];let current=[],offset=0;
  function fits(){return inner.scrollWidth<=inner.clientWidth+1&&inner.scrollHeight<=inner.clientHeight+1}
  function flush(){if(current.length){result.push({parts:current,start:current[0].start,end:current[current.length-1].end});current=[];inner.replaceChildren()}}
  try{for(const text of blocks){let chars=split(text),continued=false;while(chars.length){const part={text:chars.join(''),continued,start:offset,end:offset},p=addPart(inner,part);let lo=0,hi=chars.length;
   while(lo<hi){const mid=Math.ceil((lo+hi)/2);p.textContent=chars.slice(0,mid).join('');if(fits())lo=mid;else hi=mid-1}
   if((!lo||(lo<chars.length&&chars.length<=20))&&current.length){p.remove();flush();continue}if(!lo)throw Error('Page is too small');
   if(lo<chars.length){while(lo>1&&/^[、。，．？！!?」』）】〉》〕］…ー]/u.test(chars[lo]))lo--;while(lo>1&&/^[「『（【〈《〔［]$/u.test(chars[lo-1]))lo--}
   part.text=chars.slice(0,lo).join('');p.textContent=part.text;offset+=lo;part.end=offset;current.push(part);chars=chars.slice(lo);continued=true;if(chars.length)flush();
  }}flush()}finally{measure.remove()}return result;
 }
 function fallback(error){console.warn('Reader fallback:',error);host.hidden=true;source.classList.remove('tp-original');source.classList.add('tp-plain')}
 function build(keep=anchor()){
  if(host.hidden||building)return;building=true;
  try{const style=getComputedStyle(host),width=host.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);single=width<560;pageWidth=Math.max(200,Math.floor(Math.min(width/(single?1:2),440)));pageHeight=Math.max(340,Math.min(620,Math.floor(innerHeight*.74),Math.round(pageWidth*1.6)));
   chunks=paginate();if(!chunks.length)throw Error('Empty story');total=chunks.length+2;
   const cover=el('div','tp-page tp-cover');cover.setAttribute('aria-label','表紙');const panel=el('div','tp-cover-panel');panel.append(el('div','tp-cover-title',title));cover.append(panel);
   const blank=el('div','tp-page tp-blank');blank.setAttribute('aria-label','白紙');
   pages=[cover,blank,...chunks.map((chunk,i)=>{const p=el('div','tp-page '+(i%2?'tp-page-even':'tp-page-odd')),inner=el('div','tp-page-inner');chunk.parts.forEach(part=>addPart(inner,part));p.append(inner,el('span','tp-page-no',String(i+1)));p.setAttribute('aria-label',`本文${i+1}ページ`);p.dataset.start=String(chunk.start);return p})];
   if(!single&&pages.length%2)pages.push(el('div','tp-page'));pages.reverse();
   if(book){book.destroy();stage.replaceChildren();bookEl=el('div','tp-book');stage.append(bookEl)}bookFrame.style.width=stage.style.width=pageWidth*(single?1:2)+'px';stage.style.height=pageHeight+'px';
   book=new St.PageFlip(bookEl,{width:pageWidth,height:pageHeight,size:'fixed',autoSize:false,usePortrait:single,showCover:false,startPage:Math.max(0,pages.length-Math.min(pageFor(keep),total)),showPageCorners:false,flippingTime:reduced?1:650,drawShadow:!reduced,maxShadowOpacity:.22,mobileScrollSupport:false,disableFlipByClick:false});
   book.on('flip',update);book.on('changeOrientation',update);book.on('changeState',event=>{if(event.data==='read')paintBookmark();else ribbon.hidden=true});book.loadFromHTML(pages);update();if(!source.classList.contains('tp-plain'))source.classList.add('tp-original');
  }finally{building=false}
 }
 function rebuild(keep){try{build(keep)}catch(error){fallback(error)}}
 next.onclick=()=>book?.flipPrev('bottom');prev.onclick=()=>book?.flipNext('bottom');
 host.addEventListener('keydown',e=>{if(e.target.closest('.tp-toolbar'))return;if(e.key==='ArrowLeft'){e.preventDefault();if(!next.disabled)next.click()}if(e.key==='ArrowRight'){e.preventDefault();if(!prev.disabled)prev.click()}});
 themeButton.onclick=()=>{theme=theme==='dark'?'light':'dark';applySettings();write('tanpen-reader-settings-v1',{theme,size})};
 for(const key in sizeButtons)sizeButtons[key].onclick=()=>{if(key===size)return;const keep=anchor();size=key;applySettings();write('tanpen-reader-settings-v1',{theme,size});rebuild(keep)};
 saveButton.onclick=()=>{const candidate={...anchor(),offset:anchor().offset||0,title,updatedAt:new Date().toISOString()};if(write(bookmarkKey,candidate)){saved=candidate;bookmarkButtons()}};
 goButton.onclick=()=>{if(!saved)return;if(source.classList.contains('tp-plain'))mode.click();book.turnToPage(Math.max(0,pages.length-pageFor(saved)));update()};
 removeButton.onclick=()=>{if(write(bookmarkKey,null)){saved=null;bookmarkButtons()}};
 mode.onclick=()=>{const plain=source.classList.toggle('tp-plain');bookFrame.hidden=controls.hidden=plain;source.classList.toggle('tp-original',!plain);mode.textContent=plain?'ページめくりで読む':'通常の文章で読む';if(!plain)update()};
 applySettings();bookmarkButtons();
 try{await document.fonts.load('18px TanpenReader');await document.fonts.ready;build({front:1});let lastWidth=host.clientWidth;new ResizeObserver(()=>{const w=host.clientWidth;if(Math.abs(w-lastWidth)<2)return;lastWidth=w;clearTimeout(timer);const keep=anchor();timer=setTimeout(()=>rebuild(keep),180)}).observe(host)}catch(error){fallback(error)}
}
async function boot(){if(!window.St?.PageFlip)await loadScript(BASE+'vendor/page-flip.browser.js');for(const source of document.querySelectorAll('.entry-content'))await mount(source)}
const css=document.createElement('link');css.rel='stylesheet';css.href=BASE+'reader-v9.css';css.onload=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot().catch(console.warn),{once:true});else boot().catch(console.warn)};document.head.append(css);
})();
