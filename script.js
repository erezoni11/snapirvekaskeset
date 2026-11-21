const $ = (selector, node=document) => node.querySelector(selector);
const $$ = (selector, node=document) => [...node.querySelectorAll(selector)];
const menu = $('.menu');
menu.addEventListener('click', () => {
  const open = $('.navigation').classList.toggle('open');
  menu.setAttribute('aria-expanded', open);
});
$$('.navigation a').forEach(a=>a.addEventListener('click',()=>{
  $('.navigation').classList.remove('open');
  menu.setAttribute('aria-expanded','false');
}));
const cartKey='snapir-cart-v1';
let cart=[];
try {
  const saved=JSON.parse(localStorage.getItem(cartKey)||'[]');
  if(Array.isArray(saved)) cart=saved.filter(item=>item&&typeof item.name==='string'&&typeof item.weight==='string'&&typeof item.cut==='string'&&/^assets\/[\w-]+\.png$/.test(item.image)&&Number.isInteger(item.amount)&&item.amount>0&&item.amount<=99&&Number.isInteger(item.unitPrice)&&item.unitPrice>0);
} catch {}
const money=cents=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'}).format(cents/100);
const drawer=$('#cart-dialog');
let closingTimer;
function saveCart(){
  try{localStorage.setItem(cartKey,JSON.stringify(cart));}catch{}
  const count=cart.reduce((sum,item)=>sum+item.amount,0);
  $('.cart-count').textContent=count;
  $('#drawer-count').textContent=count;
  $('.cart-btn').setAttribute('aria-label',`סל קניות, ${count} פריטים`);
}
function renderCart(){
  const list=$('#cart-items');list.replaceChildren();
  if(!cart.length){
    const empty=document.createElement('div');empty.className='cart-empty';
    empty.innerHTML='<div class="empty-cart-icon"><svg><use href="#i-cart"/></svg></div><h3>הסל מחכה לבחירה שלכם</h3><p>דגים טובים מתחילים בארוחה טובה.<br>בחרו את מה שאוהבים, ונשמור אותו כאן.</p><button class="empty-browse">לבחירת מוצרים <span aria-hidden="true">←</span></button>';
    $('.empty-browse',empty).onclick=closeCart;list.append(empty);
  }
  cart.forEach((item,index)=>{
    const row=document.createElement('article');row.className='cart-entry';
    const image=document.createElement('img');image.src=item.image;image.alt=item.name;
    const details=document.createElement('div');details.className='cart-entry-details';
    const title=document.createElement('h3');title.textContent=item.name;
    const meta=document.createElement('p');meta.textContent=`${item.weight} · ${item.cut}`;
    const price=document.createElement('strong');price.textContent=money(item.unitPrice*item.amount);
    const controls=document.createElement('div');controls.className='cart-entry-controls';
    const quantity=document.createElement('div');quantity.className='cart-quantity';
    for(const [label,text,delta] of [['הפחתת כמות','−',-1],['הגדלת כמות','+',1]]){
      const button=document.createElement('button');button.textContent=text;button.setAttribute('aria-label',`${label} של ${item.name}`);
      button.disabled=delta===-1?item.amount<=1:item.amount>=99;
      button.onclick=()=>{item.amount+=delta;saveCart();renderCart();$('.cart-entry:nth-child('+(index+1)+') .cart-quantity button:'+(delta<0?'first-child':'last-child'))?.focus();};
      quantity.append(button);
      if(delta===-1){const output=document.createElement('span');output.textContent=item.amount;output.setAttribute('aria-label','כמות');quantity.append(output);}
    }
    const remove=document.createElement('button');remove.className='remove-item';remove.textContent='הסרה';remove.setAttribute('aria-label',`הסרת ${item.name} מהסל`);
    remove.onclick=()=>{cart.splice(index,1);saveCart();renderCart();($('.remove-item',list)||$('.drawer-close')).focus();};
    controls.append(quantity,remove);details.append(title,meta,price,controls);row.append(image,details);list.append(row);
  });
  $('.cart-total').textContent=money(cart.reduce((sum,item)=>sum+item.unitPrice*item.amount,0));
}
function openCart(){
  clearTimeout(closingTimer);renderCart();
  if(!drawer.open)drawer.showModal();
  document.body.classList.add('cart-is-open');
  requestAnimationFrame(()=>drawer.classList.add('is-open'));
}
function closeCart(){
  drawer.classList.remove('is-open');
  clearTimeout(closingTimer);
  closingTimer=setTimeout(()=>{drawer.close();document.body.classList.remove('cart-is-open');},matchMedia('(prefers-reduced-motion: reduce)').matches?0:280);
}
$('.cart-btn').onclick=openCart;
$('.drawer-close').onclick=closeCart;
$('.continue-shopping').onclick=closeCart;
drawer.addEventListener('cancel',event=>{event.preventDefault();closeCart();});
drawer.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const buttons=$$('button:not(:disabled)',drawer).filter(button=>button.getClientRects().length);
  const first=buttons[0],last=buttons.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
drawer.addEventListener('click',event=>{if(event.target===drawer){const rect=drawer.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeCart();}});
drawer.addEventListener('close',()=>{drawer.classList.remove('is-open');document.body.classList.remove('cart-is-open');});
let dragStart=null;
const grip=$('.drawer-grip');
grip.addEventListener('pointerdown',event=>{if(event.button!==0)return;dragStart=event.clientX;grip.setPointerCapture(event.pointerId);drawer.classList.add('is-dragging');});
grip.addEventListener('pointermove',event=>{if(dragStart===null)return;drawer.style.setProperty('--drag-x',`${Math.max(0,event.clientX-dragStart)}px`);});
function endDrag(event){
  if(dragStart===null)return;
  const distance=event.clientX-dragStart;dragStart=null;
  drawer.classList.remove('is-dragging');drawer.style.removeProperty('--drag-x');
  if(event.type!=='pointercancel'&&distance>Math.min(100,drawer.clientWidth*.23))closeCart();
}
grip.addEventListener('pointerup',endDrag);grip.addEventListener('pointercancel',endDrag);
window.addEventListener('storage',event=>{if(event.key===cartKey){try{const saved=JSON.parse(event.newValue||'[]');if(Array.isArray(saved))location.reload();}catch{}}});
saveCart();
let toastTimer;
function toast(message){
  const el=$('.toast');el.textContent=message;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
}
$$('.service').forEach(button=>button.addEventListener('click',()=>{
  $$('.service').forEach(x=>x.setAttribute('aria-pressed', String(x===button)));
  toast(button.dataset.delivery==='delivery'?'נבחר משלוח עד הבית':'נבחר איסוף עצמי');
}));
$$('.favorite').forEach(button=>button.addEventListener('click',()=>button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'))));
$$('.product').forEach(product=>{
  const output=$('output',product);
  $('.plus',product).onclick=()=>output.value=String(Math.min(99,Number(output.value)+1));
  $('.minus',product).onclick=()=>output.value=String(Math.max(1,Number(output.value)-1));
  $('.add-cart',product).onclick=()=>{
    const amount=Number(output.value), selects=$$('select',product);
    const weight=selects[0].selectedOptions[0].text,cut=selects[1].value;
    const item=cart.find(item=>item.name===product.dataset.name&&item.weight===weight&&item.cut===cut);
    if(item)item.amount=Math.min(99,item.amount+amount);
    else cart.push({name:product.dataset.name,weight,cut,amount,image:$('.product-image>img',product).getAttribute('src'),unitPrice:Math.round(Number(product.dataset.price)*100*Number(selects[0].value))});
    saveCart();openCart();
  };
});
$('.search-btn').onclick=()=>$('#search-dialog').showModal();
$('#search-dialog input').addEventListener('input',event=>{
  const q=event.target.value.trim();
  $$('.product').forEach(p=>p.hidden=q&&!p.textContent.includes(q));
  const empty=$('.search-empty');if(empty)empty.hidden=$$('.product').some(p=>!p.hidden);
});
const sort=$('#product-sort');
const initialProducts=$$('.product');
sort?.addEventListener('change',()=>{
  const products=[...initialProducts];
  if(sort.value==='price-up')products.sort((a,b)=>Number(a.dataset.price)-Number(b.dataset.price));
  if(sort.value==='price-down')products.sort((a,b)=>Number(b.dataset.price)-Number(a.dataset.price));
  if(sort.value==='name')products.sort((a,b)=>a.dataset.name.localeCompare(b.dataset.name,'he'));
  $('.product-grid').append(...products);
});
const dots=$$('.dots button');let slide=0;
const banners=[
  {title:'מהים.<br>ישר אליכם.',text:'דגים טריים, איכות ללא פשרות',photo:'assets/hero-desktop.png',mobile:'assets/hero-mobile.png'},
  {title:'טריות בכל ביס.',text:'מבחר דגי ים מובחרים',photo:'assets/denis.png',mobile:'assets/denis.png'},
  {title:'איכות שמרגישים.',text:'הדגים האהובים עליכם',photo:'assets/salmon.png',mobile:'assets/salmon.png'}
];
function renderSlide(i){
  slide=(i+banners.length)%banners.length;
  dots.forEach((dot,n)=>dot.classList.toggle('active',n===slide));
  const banner=banners[slide];$('.hero h1').innerHTML=banner.title;$('.hero p').textContent=banner.text;
  const photo=$('.hero-photo');
  photo.style.backgroundImage=slide===0?'':`url("${innerWidth<=700?banner.mobile:banner.photo}")`;
  photo.style.backgroundSize=slide===0?'':'cover';
}
dots.forEach((dot,i)=>dot.onclick=()=>renderSlide(i));
$('.previous')?.addEventListener('click',()=>renderSlide(slide-1));$('.next')?.addEventListener('click',()=>renderSlide(slide+1));
$('.cat-prev')?.addEventListener('click',()=>$('.category-grid').scrollBy({left:-200,behavior:'smooth'}));
$('.cat-next')?.addEventListener('click',()=>$('.category-grid').scrollBy({left:200,behavior:'smooth'}));
