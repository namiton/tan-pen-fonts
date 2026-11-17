/* Short-story reader. StPageFlip (MIT, Copyright 2020 Nodlik).
   Integration and pagination: MIT. No story text leaves this page. */
(()=>{'use strict';
const BASE='https://namiton.github.io/tan-pen-fonts/reader/';
const split=s=>globalThis.Intl?.Segmenter?[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(s)].map(x=>x.segment):Array.from(s);
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s)})}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
async function mount(source){
 if(source.dataset.tpMounted)return;source.dataset.tpMounted='1';
 const blocks=[...source.children].filter(n=>n.tagName==='P').map(n=>n.innerText).filter(s=>s.trim());
 if(!blocks.length)return;
 const host=el('section','tp-reader');host.setAttribute('aria-label','縦書きの読書ビュー');
 const stage=el('div','tp-stage'),controls=el('nav','tp-controls');let bookEl=el('div','tp-book');controls.setAttribute('aria-label','ページ操作');
 const next=el('button','','次のページ ←'),prev=el('button','','→ 前のページ'),status=el('span','tp-status');
 status.setAttribute('aria-live','polite');const mode=el('button','tp-mode','通常の文章で読む');
 next.type=prev.type=mode.type='button';controls.append(next,status,prev);stage.append(bookEl);
 host.append(stage,controls,el('p','tp-hint','左のページを右へめくると、先へ進みます。'),mode);source.before(host);
 let book=null,pages=[],pageWidth=0,pageHeight=0,single=false,logical=1,timer;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 function update(){if(!book)return;const i=book.getCurrentPageIndex();const portrait=book.getOrientation()==='portrait';logical=pages.length-i-(portrait?0:1);logical=Math.max(1,logical);const last=Math.min(total,logical+(portrait?0:1));status.textContent=logical>=total?`${total} / ${total}`:`${logical}${last>logical?'–'+last:''} / ${total}`;next.disabled=last>=total;prev.disabled=logical<=1}
 let total=0;
 function paginate(){
  const measure=el('div','tp-page tp-measure');measure.style.width=pageWidth+'px';measure.style.height=pageHeight+'px';const inner=el('div','tp-page-inner');measure.append(inner);host.append(measure);
  const chunks=[];let current=[];
  function fits(){return inner.scrollWidth<=inner.clientWidth+1&&inner.scrollHeight<=inner.clientHeight+1}
  function flush(){if(current.length){chunks.push(current);current=[];inner.replaceChildren()}}
  try{for(const text of blocks){let chars=split(text);while(chars.length){const p=el('p');inner.append(p);let lo=0,hi=chars.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);p.textContent=chars.slice(0,mid).join('');if(fits())lo=mid;else hi=mid-1}
   if(!lo){p.remove();if(current.length){flush();continue}throw Error('Page is too small')}
   // Keep closing punctuation with the preceding line where possible.
   if(lo<chars.length){while(lo>1&&/^[、。，．？！!?」』）】〉》〕］］…ー]/u.test(chars[lo]))lo--;while(lo>1&&/^[「『（【〈《〔［]$/u.test(chars[lo-1]))lo--}
   p.textContent=chars.slice(0,lo).join('');current.push(p.textContent);chars=chars.slice(lo);if(chars.length)flush();
  }}flush()}finally{measure.remove()}
  return chunks;
 }
 function build(){
  if(host.hidden)return;const width=host.clientWidth;single=width<700;pageWidth=Math.max(240,Math.floor(Math.min(width/(single?1:2),440)));pageHeight=Math.max(340,Math.min(620,Math.floor(innerHeight*.72)));
  const keep=logical;const chunks=paginate();total=chunks.length;if(!total)throw Error('Empty story');
  pages=chunks.map((chunk,i)=>{const p=el('div','tp-page');const inner=el('div','tp-page-inner');chunk.forEach(t=>inner.append(el('p','',t)));p.append(inner,el('span','tp-page-no',String(i+1)));p.setAttribute('aria-label',`${i+1}ページ`);return p});
  if(!single&&pages.length%2)pages.push(el('div','tp-page'));pages.reverse();
  if(book){book.destroy();stage.replaceChildren();bookEl=el('div','tp-book');stage.append(bookEl)}
  stage.style.width=pageWidth*(single?1:2)+'px';stage.style.height=pageHeight+'px';
  book=new St.PageFlip(bookEl,{width:pageWidth,height:pageHeight,size:'fixed',autoSize:false,usePortrait:single,showCover:false,startPage:Math.max(0,pages.length-Math.min(keep,total)),showPageCorners:true,flippingTime:reduced?1:650,drawShadow:!reduced,maxShadowOpacity:.22,mobileScrollSupport:false,disableFlipByClick:true});
  book.on('flip',update);book.on('changeOrientation',update);book.loadFromHTML(pages);update();source.classList.add('tp-original');
 }
 next.onclick=()=>book?.flipPrev('bottom');prev.onclick=()=>book?.flipNext('bottom');
 host.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();if(!next.disabled)next.click()}if(e.key==='ArrowRight'){e.preventDefault();if(!prev.disabled)prev.click()}});
 mode.onclick=()=>{const plain=source.classList.toggle('tp-plain');stage.hidden=controls.hidden=plain;host.querySelector('.tp-hint').hidden=plain;source.classList.toggle('tp-original',!plain);mode.textContent=plain?'ページめくりで読む':'通常の文章で読む';if(!plain)update()};
 try{await document.fonts.load('18px TanpenReader');await document.fonts.ready;build();let lastWidth=source.parentElement.clientWidth;new ResizeObserver(()=>{const w=source.parentElement.clientWidth;if(Math.abs(w-lastWidth)<2)return;lastWidth=w;clearTimeout(timer);timer=setTimeout(()=>{try{build()}catch(e){fallback(e)}},180)}).observe(source.parentElement)}catch(e){fallback(e)}
 function fallback(e){console.warn('Reader fallback:',e);host.hidden=true;source.classList.remove('tp-original');source.classList.add('tp-plain')}
}
async function boot(){if(!window.St?.PageFlip)await loadScript(BASE+'vendor/page-flip.browser.js');for(const s of document.querySelectorAll('.entry-content'))await mount(s)}
const css=document.createElement('link');css.rel='stylesheet';css.href=BASE+'reader.css';css.onload=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot().catch(console.warn),{once:true});else boot().catch(console.warn)};document.head.append(css);
})();
