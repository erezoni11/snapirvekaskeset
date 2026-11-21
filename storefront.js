/* Published content only. Draft previews are passed in-memory by the admin iframe. */
(() => {
  const $=(s,n=document)=>n.querySelector(s),$$=(s,n=document)=>[...n.querySelectorAll(s)];
  const originalProduct=$('.product')?.cloneNode(true);
  const params=new URLSearchParams(location.search);
  let previewApplied=false;
  const safeURL=value=>{try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};
  const text=(selector,value)=>{const el=$(selector);if(el&&value!==undefined)el.textContent=value;};
  const background=(el,value)=>{const url=safeURL(value);if(el&&url)el.style.backgroundImage=`url(${JSON.stringify(url)})`;};
  const route=category=>['sea','pool','frozen','smoked','deli'].includes(category)?category+'.html':'sea.html?category='+encodeURIComponent(category);
  function productCard(doc,preview){
    if(!originalProduct)return null;
    const card=originalProduct.cloneNode(true),p=doc.data;
    card.dataset.name=p.title;card.dataset.price=Number(p.price_cents)/100;card.dataset.productId=doc.id;card.dataset.live='true';card.dataset.available=doc.available_kg??0;
    $('h3',card).textContent=p.title;$('p',card).textContent=p.description||'';
    const img=$('.product-image>img',card);img.src=safeURL(p.image)||'assets/logo.png';img.alt=p.title;
    const favorite=$('.favorite',card);favorite.setAttribute('aria-label','הוספת '+p.title+' למועדפים');favorite.setAttribute('aria-pressed','false');
    const price=$('.price',card);price.replaceChildren(document.createTextNode((Number(p.price_cents)/100).toFixed(2)+' '));const unit=document.createElement('small');unit.textContent='₪ לק״ג';price.append(unit);
    const selects=$$('select',card);selects[0].replaceChildren(...(p.weights||[1]).map(weight=>new Option(weight<1?`${weight*1000} גרם`:`${weight} ק״ג`,weight)));selects[1].replaceChildren(...(p.cuts||['שלם']).map(cut=>new Option(cut,cut)));
    const add=$('.add-cart',card);const available=Number(doc.available_kg||0);
    const updateAvailability=()=>{const unavailable=!preview&&available<Number(selects[0].value);add.disabled=preview||unavailable;if(preview)add.textContent='תצוגה מקדימה';else if(unavailable)add.textContent='אזל מהמלאי';else add.innerHTML='<svg><use href="#i-cart"/></svg>להוספה לסל';};
    selects[0].addEventListener('change',updateAvailability);updateAvailability();$('output',card).value='1';
    return card;
  }
  function apply(docs,preview=false){
    $('.storefront-status')?.remove();const liveGrid=$('.product-grid');if(liveGrid){liveGrid.hidden=false;liveGrid.inert=false;liveGrid.removeAttribute('aria-busy');}
    const live=docs.filter(d=>d.data&&d.data.active!==false);
    const categories=live.filter(d=>d.kind==='categories').sort((a,b)=>(a.data.position||0)-(b.data.position||0));
    const pages=live.filter(d=>d.kind==='pages').sort((a,b)=>(a.data.position||0)-(b.data.position||0));
    const settings=live.find(d=>d.kind==='settings'&&d.slug==='main')?.data;
    const category=params.get('category')||$('a[data-category][aria-current=page]')?.dataset.category;
    const nav=$('.navigation');if(nav){nav.replaceChildren(...categories.map(doc=>{const a=document.createElement('a');a.href=route(doc.slug);a.dataset.category=doc.slug;a.textContent=doc.data.title;if(category===doc.slug)a.setAttribute('aria-current','page');return a;}),...pages.filter(d=>d.data.show_menu).map(doc=>{const a=document.createElement('a');a.href='page.html?slug='+encodeURIComponent(doc.slug);a.textContent=doc.data.title;return a;}));}
    if(settings){
      window.storefrontSettings=settings;
      const logo=$('.logo img');if(logo){logo.src=safeURL(settings.logo)||'assets/logo.png';logo.alt=settings.title||'סנפיר וקשקשת';}
      for(const [field,selector] of Object.entries({hero_title:'.hero h1',hero_subtitle:'.hero p',categories_heading:'.categories .heading span',products_heading:'.products>.heading span',delivery_title:'[data-delivery=delivery] strong',delivery_subtitle:'[data-delivery=delivery] small',pickup_title:'[data-delivery=pickup] strong',pickup_subtitle:'[data-delivery=pickup] small'}))text(selector,settings[field]);
      const cta=$('.hero-cta');if(cta&&settings.hero_cta){cta.replaceChildren(document.createTextNode(settings.hero_cta+' ←'));}
      background($('.hero-photo'),innerWidth<=700?settings.hero_mobile||settings.hero_image:settings.hero_image);
      $('.hero h1')?.style.setProperty('white-space','pre-line');
      if(/^#[0-9a-f]{6}$/i.test(settings.accent))document.documentElement.style.setProperty('--cyan',settings.accent);
      if(/^#[0-9a-f]{6}$/i.test(settings.navy))document.documentElement.style.setProperty('--navy',settings.navy);
    }
    const categoryGrid=$('.category-grid');if(categoryGrid){categoryGrid.replaceChildren(...categories.map(doc=>{const a=document.createElement('a');a.href=route(doc.slug);a.className='category';a.dataset.live='true';const image=document.createElement('img');image.src=safeURL(doc.data.image)||'assets/logo.png';image.alt='';const span=document.createElement('span');span.textContent=doc.data.title+' ‹';a.append(image,span);return a;}));categoryGrid.style.gridTemplateColumns=`repeat(${Math.max(1,categories.length)},minmax(0,1fr))`;}
    if(category){const doc=categories.find(c=>c.slug===category);text('.catalog-intro h1',doc?.data.title||'קטגוריה לא זמינה');text('.catalog-intro h2',doc?.data.subtitle||'');text('.catalog-intro>p:last-child',doc?.data.description||'');text('.catalog-eyebrow',doc?.data.title||'');text('.breadcrumbs>span:last-child',doc?.data.title||'');if(doc){background($('.catalog-photo'),doc.data.image);document.title=doc.data.title+' | '+(settings?.title||'סנפיר וקשקשת');}}
    const grid=$('.product-grid');if(grid&&originalProduct){const products=live.filter(d=>d.kind==='products'&&categories.some(c=>c.slug===d.data.category)&&(category?d.data.category===category:d.data.featured));grid.replaceChildren(...products.map(d=>productCard(d,preview)));text('.catalog-count',products.length+' מוצרים');let empty=$('.search-empty');if(!empty){empty=document.createElement('p');empty.className='search-empty';grid.after(empty);}empty.textContent='אין מוצרים להצגה כרגע.';empty.hidden=products.length>0;}
    const discover=$('.catalog-discover>div');if(discover)discover.replaceChildren(...categories.filter(d=>d.slug!==category).map(d=>{const a=document.createElement('a');a.href=route(d.slug);a.textContent=d.data.title+' ←';return a;}));
    if(location.pathname.endsWith('/page.html')){
      const page=pages.find(d=>d.slug===params.get('slug'));text('#content-page-title',page?.data.title||'העמוד אינו זמין');text('#content-page-subtitle',page?.data.subtitle||'');text('#content-page-body',page?.data.body||'העמוד טרם פורסם או הוסר.');const img=$('#content-page-image');img.hidden=!page?.data.image;if(page?.data.image)img.src=safeURL(page.data.image);document.title=(page?.data.title||'עמוד תוכן')+' | '+(settings?.title||'סנפיר וקשקשת');
    }
    const footer=$('.site-footer');if(footer){
      if(settings){const lines=$$('p',footer);if(lines[0])lines[0].textContent=settings.footer_copyright||'';if(lines[1])lines[1].textContent=settings.footer_credit||'';}
      $('.managed-footer',footer)?.remove();const extra=document.createElement('div');extra.className='managed-footer';extra.dir='rtl';
      if(settings){const contact=document.createElement('p');contact.textContent=[settings.phone,settings.email,settings.address,settings.hours].filter(Boolean).join(' · ');extra.append(contact);}
      for(const page of pages){const a=document.createElement('a');a.href='page.html?slug='+encodeURIComponent(page.slug);a.textContent=page.data.title;extra.append(a);}footer.append(extra);
    }
    $('.demo-notice')?.remove();document.documentElement.dataset.catalogSource=preview?'preview':'supabase';
    document.dispatchEvent(new Event('catalog:updated'));
  }
  if(params.get('admin-preview')==='1')window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='svk-preview'||!Array.isArray(event.data.documents))return;
    previewApplied=true;apply(event.data.documents,true);let banner=$('.store-preview-banner');if(!banner){banner=document.createElement('div');banner.className='store-preview-banner';banner.textContent='תצוגה מקדימה של טיוטה · השינויים עדיין לא פורסמו';document.body.prepend(banner);}
  });
  document.documentElement.dataset.catalogSource='static';
  const grid=$('.product-grid');
  if(grid){grid.inert=true;grid.setAttribute('aria-busy','true');$$('.add-cart',grid).forEach(button=>button.disabled=true);}
  function fallback(isDemo){
    if(previewApplied)return;
    const host=$('.products')||$('.content-page');if(!host)return;
    const note=document.createElement('p');note.className='storefront-status';note.setAttribute('role','status');
    note.textContent=isDemo?'הקטלוג מוצג להמחשה בלבד. המוצרים והמחירים אינם זמינים להזמנה.':'לא ניתן לטעון כרגע את קטלוג המוצרים. יש לנסות לרענן את העמוד.';
    host.prepend(note);
    if(grid){grid.removeAttribute('aria-busy');grid.inert=!isDemo;grid.hidden=!isDemo;if(isDemo)$$('.add-cart',grid).forEach(button=>button.disabled=false);}
    document.documentElement.dataset.catalogSource=isDemo?'static':'unavailable';
  }
  if(window.supabaseClient)window.supabaseClient.rpc('svk_catalog').abortSignal(AbortSignal.timeout(8000)).then(({data,error})=>{
    if(previewApplied)return;
    if(error){fallback(error.code==='PGRST202');return;}
    if(Array.isArray(data))apply(data);else fallback(false);
  }).catch(()=>fallback(false));
  else fallback(false);
})();
