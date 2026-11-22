'use strict';
(() => {
const $=(s,n=document)=>n.querySelector(s), $$=(s,n=document)=>[...n.querySelectorAll(s)];
const local=window.snapirLocalPreview;
const demo=!!local||new URLSearchParams(location.search).get('demo')==='1';
let localVersion=0;
const db=window.supabaseClient;
const roles={admin:'מנהל',content:'עריכת תוכן',shop:'ניהול חנות',orders:'ניהול הזמנות'};
const statuses={new:'ממתינה לאישור',processing:'אושרה ובטיפול',ready:'מוכנה',shipped:'נשלחה',completed:'הושלמה',cancelled:'בוטלה'};
const labels={dashboard:'סקירה כללית',products:'מוצרים',categories:'קטגוריות',inventory:'מלאי',orders:'הזמנות',customers:'לקוחות',shipping:'משלוחים',settings:'תוכן האתר',pages:'עמודי תוכן',staff:'צוות והרשאות',audit:'יומן פעילות'};
const descriptions={dashboard:'כל מה שקורה בחנות, במבט אחד.',products:'ניהול מוצרים, מחירים ואפשרויות חיתוך ומשקל.',categories:'סדר הקטגוריות בתפריט ובחנות.',inventory:'מלאי זמין בקילוגרמים. שינויים נכנסים לתוקף מיד.',orders:'הזמנות מהאתר והזמנות ידניות, אישור, הכנה, משלוח או איסוף עצמי. ללא סליקה אונליין.',customers:'פרטי הלקוחות והכתובות המשויכים להזמנות.',shipping:'אזורי חלוקה, עלויות ואפשרויות איסוף.',settings:'הבאנרים, הטקסטים, פרטי העסק והמיתוג של האתר.',pages:'עמודי מידע וקישורים בתפריט האתר.',staff:'חשבונות אישיים ותפקידים. רק מנהלים יכולים לשנות הרשאות.',audit:'תיעוד של שינויים, פרסום ועדכוני הזמנות.'};
const paths={dashboard:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',products:'M3 7l9-4 9 4v12l-9 3-9-3zM3 7l9 4 9-4M12 11v11',categories:'M3 5h18M3 12h18M3 19h18',inventory:'M3 8h18v13H3zM2 3h20v5H2zM9 12h6',orders:'M6 3h12v19l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',customers:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 5a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4',shipping:'M2 5h13v13H2zM15 10h4l3 4v4h-7M5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 0 4',settings:'M4 4h16v16H4zM4 9h16M9 9v11',pages:'M6 2h9l5 5v15H6zM15 2v6h5M9 12h8M9 16h8',staff:'M12 3l9 4v6c0 5-9 9-9 9s-9-4-9-9V7zM8 12l3 3 5-6',audit:'M12 8v5l4 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9'};
const icon=key=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key]||paths.pages}"/></svg>`;
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'}).format((value||0)/100);
const date=value=>new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));
const badge=(text,type)=>`<span class="badge ${h(type)}">${h(text)}</span>`;
const imageURL=value=>{try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};
let staff,section='dashboard',documents=[],published=[],inventory=[],customers=[],orders=[],team=[],audit=[],editor=null,seed=[],pageIndex=0,search='';
const pageSize=25;
const allowed=()=>staff?.role==='admin'?Object.keys(labels):({content:['dashboard','settings','pages'],shop:['dashboard','products','categories','inventory'],orders:['dashboard','orders','customers','shipping']}[staff?.role]||[]);
const editKinds=()=>staff?.role==='admin'?['products','categories','settings','pages','shipping']:({content:['settings','pages'],shop:['products','categories'],orders:['shipping']}[staff?.role]||[]);
function notice(text,error=false){const el=$('#admin-notice');el.textContent=text;el.classList.toggle('error',error);el.hidden=!text;}
function friendly(error){
  const message=String(error?.message||error||'');
  if(/schema cache|does not exist|PGRST202|PGRST205/.test(message+' '+error?.code))return 'תשתית הניהול עדיין לא הותקנה בדטאבייס. יש להפעיל את קובץ ההתקנה ולהגדיר את המנהלים הראשונים לפי מדריך ההפעלה.';
  if(/40001|changed|Reload/.test(message+' '+error?.code))return 'הרשומה השתנתה מאז שפתחת אותה. סגור את העורך, רענן את הנתונים ונסה שוב.';
  if(/Forbidden|permission|42501/.test(message+' '+error?.code))return 'אין לך הרשאה לפעולה הזו. פנה למנהל החנות.';
  if(/Insufficient stock/.test(message))return 'אין מלאי מספיק לאחד המוצרים בהזמנה. עדכן את הכמויות או את המלאי.';
  if(/Publish the product category first/.test(message))return 'יש לפרסם קודם את הקטגוריה שאליה משויך המוצר.';
  if(/duplicate|23505/.test(message+' '+error?.code))return 'מזהה הכתובת הזה כבר קיים. בחר מזהה אחר.';
  if(/fetch|network/i.test(message))return 'לא ניתן להתחבר כרגע. בדוק את החיבור ונסה שוב.';
  if(/Invalid login credentials|invalid_credentials/i.test(message+' '+error?.code))return 'שם המשתמש או הסיסמה שגויים.';
  return 'הפעולה לא הושלמה. '+message;
}
async function unwrap(query){const result=await query;if(result.error)throw result.error;return result.data;}
async function rows(table,order){
  let all=[],offset=0;
  while(true){const batch=await unwrap(db.from(table).select('*').order(order).range(offset,offset+999));all.push(...batch);if(batch.length<1000)return all;offset+=1000;}
}
function demoAudit(action,resource,id){audit.unshift({id:Date.now(),actor:staff.user_id,action,resource,resource_id:id,created_at:new Date().toISOString()});if(local){local.save({documents,published,inventory,customers,orders,team,audit},localVersion);localVersion++;}}
async function load(){
  if(local){await local.ready;const state=local.read();({documents,published,inventory,customers,orders,team,audit}=state);localVersion=state.version;return;}
  if(demo)return;
  const result=await Promise.all([
    rows('svk_drafts','slug'),rows('svk_published','slug'),
    ['admin','shop','orders'].includes(staff.role)?rows('svk_inventory','product_id'):[],
    ['admin','orders'].includes(staff.role)?rows('svk_customers','name'):[],
    ['admin','orders'].includes(staff.role)?rows('svk_orders','created_at'):[],
    staff.role==='admin'?rows('svk_staff','display_name'):[],
    staff.role==='admin'?unwrap(db.from('svk_audit').select('*').order('id',{ascending:false}).limit(100)):[]
  ]);
  [documents,published,inventory,customers,orders,team,audit]=result;orders.sort((a,b)=>b.number-a.number);
}
function button(text,fn,cls='admin-primary'){const el=document.createElement('button');el.className=cls;el.textContent=text;el.onclick=fn;return el;}
function setActions(){
  const el=$('#section-actions');el.replaceChildren();
  el.append(button('רענון',async()=>{try{await load();render();notice('הנתונים עודכנו.');}catch(e){notice(friendly(e),true);}},'admin-secondary'));
  if(editKinds().includes(section))el.append(button(section==='settings'?'הגדרות חדשות':'הוספה חדשה',()=>openDocument()));
  if(section==='customers')el.append(button('הוספת לקוח',()=>openCustomer()));
  if(section==='orders')el.append(button('הזמנה ידנית חדשה',()=>openOrder()));
  if(section==='staff')el.append(button('הענקת הרשאה לחשבון קיים',()=>openStaff()));
  if(section==='dashboard'&&staff.role==='admin'&&!documents.length)el.append(button('ייבוא הקטלוג הקיים כטיוטות',importSeed));
}
function navigate(key){if(!allowed().includes(key))return;section=key;pageIndex=0;search='';location.hash=key;notice('');render();}
function render(){
  if(!allowed().includes(section))section='dashboard';
  $('#section-title').textContent=labels[section];$('#section-description').textContent=descriptions[section];
  $('#section-eyebrow').textContent=section==='dashboard'?'מבט על החנות':'ניהול · '+labels[section];
  $$('#admin-nav button').forEach(el=>el.setAttribute('aria-current',el.dataset.section===section?'page':'false'));
  setActions();
  if(section==='dashboard')renderDashboard();else renderTable();
}
function renderDashboard(){
  const products=published.filter(d=>d.kind==='products'),pending=orders.filter(o=>!['completed','cancelled'].includes(o.status)),drafts=documents.filter(d=>published.find(p=>p.id===d.id)?.version!==d.version);
  const low=inventory.filter(i=>Number(i.quantity_kg)<5),sales=orders.filter(o=>o.status==='completed').reduce((sum,o)=>sum+o.total_cents,0);
  const metrics=staff.role==='content'?[['settings','טיוטות תוכן',drafts.length,'שינויים שטרם פורסמו'],['pages','עמודי תוכן',documents.filter(d=>d.kind==='pages').length,'ניהול מידע באתר']]:staff.role==='shop'?[['products','מוצרים מפורסמים',products.length,'בקטלוג האתר'],['inventory','מלאי נמוך',low.length,'פחות מ־5 ק״ג זמינים']]:[['orders','הזמנות בטיפול',pending.length,'הזמנות שטרם הושלמו'],['products','מוצרים מפורסמים',products.length,'בקטלוג האתר'],['inventory','מלאי נמוך',low.length,'פחות מ־5 ק״ג זמינים'],['orders','הזמנות שהושלמו',money(sales),'סכום הזמנות, ללא אישור גבייה']];
  $('#admin-content').innerHTML=`<div class="metrics-grid">${metrics.map(([key,title,value,help])=>`<article class="metric"><div>${h(title)}${icon(key)}</div><strong>${h(value)}</strong><small>${h(help)}</small></article>`).join('')}</div><div class="dashboard-grid"><section class="admin-card"><div class="admin-card-heading"><div><h2>${['admin','orders'].includes(staff.role)?'הזמנות אחרונות':'ממתין לפרסום'}</h2><p>תמונת המצב העדכנית של החנות</p></div></div><div class="table-scroll">${['admin','orders'].includes(staff.role)?simpleTable(['הזמנה','לקוח','סכום','סטטוס'],orders.slice(0,6).map(o=>[`#${o.number}`,h(customers.find(c=>c.id===o.customer_id)?.name||'לקוח'),money(o.total_cents),badge(statuses[o.status],o.status)])):simpleTable(['כותרת','סוג','מצב'],drafts.slice(0,6).map(d=>[h(d.data.title),h(labels[d.kind]),badge('טיוטה','draft')]))}</div></section><section class="admin-card"><div class="admin-card-heading"><div><h2>מכאן ממשיכים</h2><p>הפעולות החשובות, במרחק לחיצה</p></div></div><div class="quick-actions">${allowed().filter(k=>k!=='dashboard'&&k!=='audit').slice(0,5).map(k=>`<button data-go="${k}"><div><strong>${h(labels[k])}</strong><small>${h(descriptions[k])}</small></div><span aria-hidden="true">←</span></button>`).join('')}</div></section></div>`;
  $$('[data-go]').forEach(el=>el.onclick=()=>navigate(el.dataset.go));
}
function simpleTable(headers,items){return items.length?`<table class="admin-table"><thead><tr>${headers.map(t=>`<th>${h(t)}</th>`).join('')}</tr></thead><tbody>${items.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<div class="empty-state"><h3>כאן הכול יתחיל</h3><p>אין עדיין רשומות להצגה.</p></div>';}
function renderTable(){
  let headers,data;
  if(editKinds().includes(section)){
    headers=['פריט','מזהה כתובת','מצב פרסום','עודכן','פעולות'];
    data=documents.filter(d=>d.kind===section).map(d=>{
      const live=published.find(p=>p.id===d.id),status=!live?'טיוטה':live.version===d.version?'מפורסם':'שינויים בטיוטה';
      return {search:d.data.title+' '+d.slug,cells:[`${d.data.image?`<img src="${h(imageURL(d.data.image))}" alt="">`:''}${h(d.data.title)}${d.kind==='products'?`<small>${money(d.data.price_cents)} לק״ג</small>`:''}`,h(d.slug),badge(status,live?.version===d.version?'published':'draft'),d.updated_at?h(date(d.updated_at)):'—',`<div class="row-actions"><button data-edit="${d.id}">עריכה</button><button data-preview="${d.id}">תצוגה</button><button data-publish="${d.id}">פרסום</button>${live?`<button data-unpublish="${d.id}">הסרה מהאתר</button>`:''}</div>`]};
    });
  } else if(section==='inventory'){
    headers=['מוצר','מלאי זמין','מצב','פעולות'];data=inventory.map(i=>{const product=documents.find(d=>d.id===i.product_id)||published.find(d=>d.id===i.product_id);return {search:product?.data.title,cells:[h(product?.data.title||i.product_id),h(i.quantity_kg)+' ק״ג',badge(Number(i.quantity_kg)<5?'מלאי נמוך':'זמין',Number(i.quantity_kg)<5?'draft':'published'),`<div class="row-actions"><button data-stock="${i.product_id}">עדכון מלאי</button></div>`]};});
  } else if(section==='customers'){
    headers=['שם','טלפון','אימייל','כתובת','פעולות'];data=customers.map(c=>({search:c.name+' '+c.phone+' '+c.email,cells:[h(c.name),h(c.phone),h(c.email),h(c.address),`<div class="row-actions"><button data-customer="${c.id}">עריכה</button></div>`]}));
  } else if(section==='orders'){
    headers=['מספר','לקוח','סכום','משלוח','סטטוס','תאריך','פעולות'];data=orders.map(o=>{const customer=customers.find(c=>c.id===o.customer_id);return {search:o.number+' '+customer?.name+' '+customer?.phone,cells:['#'+o.number,h(customer?.name||'לקוח'),money(o.total_cents),h(o.shipping_name),badge(statuses[o.status],o.status),h(date(o.created_at)),`<div class="row-actions"><button data-order="${o.id}">פרטי הזמנה</button></div>`]};});
  } else if(section==='staff'){
    headers=['שם','תפקיד','מזהה חשבון','מצב','פעולות'];data=team.map(m=>({search:m.display_name+' '+m.role,cells:[h(m.display_name),h(roles[m.role]),h(m.user_id),badge(m.active?'פעיל':'מושבת',m.active?'published':'cancelled'),`<div class="row-actions"><button data-staff="${m.user_id}">עריכה</button></div>`]}));
  } else {
    headers=['פעולה','משאב','משתמש','תאריך'];data=audit.map(a=>({search:a.resource+' '+a.action,cells:[h(({INSERT:'יצירה',UPDATE:'עדכון',DELETE:'הסרה'})[a.action]||a.action),h(a.resource),h(team.find(t=>t.user_id===a.actor)?.display_name||a.actor||'מערכת'),h(date(a.created_at))]}));
  }
  const filtered=data.filter(row=>String(row.search||'').toLowerCase().includes(search.toLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));pageIndex=Math.min(pageIndex,pages-1);
  $('#admin-content').innerHTML=`<section class="admin-card"><div class="table-toolbar"><input id="table-search" type="search" aria-label="חיפוש ברשימה" placeholder="חיפוש ${h(labels[section])}…" value="${h(search)}"><small>${filtered.length} רשומות${section==='audit'?' · עד 100 פעולות אחרונות':''}</small></div><div class="table-scroll">${simpleTable(headers,filtered.slice(pageIndex*pageSize,(pageIndex+1)*pageSize).map(r=>r.cells))}</div><div class="pagination"><button id="previous-page" ${pageIndex===0?'disabled':''}>הקודם</button><span>${pageIndex+1} מתוך ${pages}</span><button id="next-page" ${pageIndex===pages-1?'disabled':''}>הבא</button></div></section>`;
  $('#table-search').oninput=event=>{const pos=event.target.selectionStart;search=event.target.value;pageIndex=0;renderTable();$('#table-search').focus();$('#table-search').setSelectionRange?.(pos,pos);};
  $('#previous-page').onclick=()=>{pageIndex--;renderTable();};$('#next-page').onclick=()=>{pageIndex++;renderTable();};
  $$('[data-edit]').forEach(b=>b.onclick=()=>openDocument(documents.find(d=>d.id===b.dataset.edit)));
  $$('[data-preview]').forEach(b=>b.onclick=()=>preview(documents.find(d=>d.id===b.dataset.preview)));
  $$('[data-publish]').forEach(b=>b.onclick=()=>publish(b.dataset.publish,true,b));
  $$('[data-unpublish]').forEach(b=>b.onclick=()=>publish(b.dataset.unpublish,false,b));
  $$('[data-stock]').forEach(b=>b.onclick=()=>openStock(inventory.find(i=>i.product_id===b.dataset.stock)));
  $$('[data-customer]').forEach(b=>b.onclick=()=>openCustomer(customers.find(c=>c.id===b.dataset.customer)));
  $$('[data-order]').forEach(b=>b.onclick=()=>viewOrder(orders.find(o=>o.id===b.dataset.order)));
  $$('[data-staff]').forEach(b=>b.onclick=()=>openStaff(team.find(m=>m.user_id===b.dataset.staff)));
}
const common=[['title','שם / כותרת','text',true],['slug','מזהה לכתובת (באנגלית)','text',true],['position','סדר תצוגה','number'],['active','מוצג באתר','checkbox']];
const schemas={
  products:[...common,['description','תיאור','textarea'],['category','קטגוריה','category',true],['price','מחיר לק״ג בש״ח','price',true],['image','תמונת מוצר','image'],['weights','משקלים לבחירה בק״ג, מופרדים בפסיק','text',true],['cuts','אפשרויות חיתוך, מופרדות בפסיק','text',true],['featured','מוצר מומלץ בעמוד הבית','checkbox']],
  categories:[...common,['subtitle','כותרת משנה','text'],['description','תיאור','textarea'],['image','תמונת קטגוריה','image']],
  pages:[...common,['subtitle','כותרת משנה','text'],['body','תוכן העמוד','textarea',true],['image','תמונת עמוד','image'],['show_menu','קישור בתפריט האתר','checkbox']],
  shipping:[...common,['method','משלוח או איסוף עצמי','fulfillment',true],['region','אזורי חלוקה / כתובת איסוף','text',true],['price','עלות משלוח בש״ח','price',true],['eta','זמני אספקה','text']],
  settings:[['title','שם העסק','text',true],['slug','מזהה הגדרות (main)','text',true],['logo','לוגו','image'],['hero_title','כותרת הבאנר הראשי','textarea'],['hero_subtitle','תיאור הבאנר הראשי','text'],['hero_cta','טקסט כפתור ההזמנה','text'],['hero_image','תמונת באנר בדסקטופ','image'],['hero_mobile','תמונת באנר במובייל','image'],['slide2_title','באנר 2 — כותרת','text'],['slide2_subtitle','באנר 2 — תיאור','text'],['slide2_image','באנר 2 — תמונה','image'],['slide3_title','באנר 3 — כותרת','text'],['slide3_subtitle','באנר 3 — תיאור','text'],['slide3_image','באנר 3 — תמונה','image'],['categories_heading','כותרת אזור הקטגוריות','text'],['products_heading','כותרת המוצרים בעמוד הבית','text'],['delivery_title','כותרת שירות המשלוחים','text'],['delivery_subtitle','תיאור שירות המשלוחים','text'],['pickup_title','כותרת האיסוף העצמי','text'],['pickup_subtitle','תיאור האיסוף העצמי','text'],['phone','טלפון העסק','text'],['email','אימייל העסק','email'],['address','כתובת העסק','text'],['hours','שעות פעילות','text'],['accent','צבע הדגשה','color'],['navy','צבע מותג כהה','color'],['footer_copyright','שורת זכויות יוצרים','text'],['footer_credit','קרדיט פיתוח','text']]
};
function field([name,label,type,required],value=''){
  const wrap=document.createElement('label');wrap.textContent=label;let input;
  if(type==='textarea'){input=document.createElement('textarea');wrap.className='full-field';}
  else if(type==='fulfillment'){input=document.createElement('select');input.append(new Option('משלוח עד הבית','delivery'),new Option('איסוף עצמי','pickup'));}
  else if(type==='category'){input=document.createElement('select');input.append(new Option('בחירת קטגוריה',''));const categories=[...published.filter(d=>d.kind==='categories'),...documents.filter(d=>d.kind==='categories')];new Map(categories.map(d=>[d.slug,d])).forEach(d=>input.append(new Option(d.data.title,d.slug)));}
  else {input=document.createElement('input');input.type=['image','price'].includes(type)?(type==='price'?'number':'text'):type;}
  input.name=name;input.required=Boolean(required);
  if(type==='checkbox'){input.checked=Boolean(value);wrap.classList.add('check-field');}
  else input.value=value??'';
  if(name==='slug'){input.pattern='[a-z0-9][a-z0-9-]{0,79}';input.dir='ltr';input.maxLength=80;}
  if(type==='number'||type==='price'){input.min=0;input.step=type==='price'?'0.01':'1';}
  wrap.append(input);
  if(type==='image'){
    const help=document.createElement('small');help.className='field-help';help.textContent='קישור תמונה או העלאה של JPG, PNG, WebP או AVIF, עד 5MB.';wrap.append(help);
    const upload=document.createElement('input');upload.type='file';upload.accept='image/jpeg,image/png,image/webp,image/avif';upload.className='file-input';upload.setAttribute('aria-label','העלאת '+label);
    upload.onchange=async()=>{const file=upload.files[0];if(!file)return;if(demo){$('#editor-error').textContent='בהדגמה אפשר לשנות את קישור התמונה. העלאת קבצים זמינה בחיבור אמיתי.';return;}
      if(file.size>5242880||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)){$('#editor-error').textContent='בחר תמונה בפורמט נתמך, עד 5MB.';return;}
      upload.disabled=true;$('#save-editor').disabled=true;
      try{const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'}[file.type];const path=crypto.randomUUID()+'.'+ext;await unwrap(db.storage.from('site-media').upload(path,file,{contentType:file.type,upsert:false}));input.value=db.storage.from('site-media').getPublicUrl(path).data.publicUrl;$('#editor-error').textContent='התמונה הועלתה. שמור את הטיוטה כדי לשייך אותה לפריט.';}catch(e){$('#editor-error').textContent=friendly(e);}finally{upload.disabled=false;$('#save-editor').disabled=false;}
    };wrap.append(upload);
  }
  return wrap;
}
function openEditor(title,fields,onSave,saveText='שמירת טיוטה',context='עריכה בטוחה · נשמר כטיוטה לפני פרסום'){
  $('#editor-title').textContent=title;$('#editor-context').textContent=context;$('#editor-error').textContent='';$('#editor-fields').replaceChildren(...fields);$('#save-editor').textContent=saveText;$('#save-editor').hidden=false;
  editor=onSave;$('#editor-dialog').showModal();
}
function openDocument(doc){
  const kind=doc?.kind||section,data=doc?.data||{},values={...data,slug:doc?.slug||(kind==='settings'?'main':''),active:data.active??true,position:data.position||0,price:data.price_cents!==undefined?data.price_cents/100:'',weights:(data.weights||[.5,1,1.5]).join(', '),cuts:(data.cuts||['שלם','פילה','פרוסות']).join(', ')};
  openEditor(doc?'עריכת '+data.title:'הוספת '+labels[kind],schemas[kind].map(def=>field(def,values[def[0]])),async form=>{
    const payload={};for(const [name,,type] of schemas[kind]){if(name==='slug')continue;payload[name]=type==='checkbox'?form.elements[name].checked:type==='number'?Number(form.elements[name].value):form.elements[name].value.trim();}
    if(kind==='products'||kind==='shipping'){payload.price_cents=Math.round(Number(payload.price)*100);delete payload.price;}
    if(kind==='products'){payload.weights=payload.weights.split(',').map(v=>Number(v.trim()));payload.cuts=payload.cuts.split(',').map(v=>v.trim()).filter(Boolean);if(payload.weights.some(v=>!Number.isFinite(v)||v<=0||v>100)||!payload.cuts.length)throw Error('יש להזין משקלים חיוביים ואפשרות חיתוך אחת לפחות.');}
    for(const key of ['image','logo','hero_image','hero_mobile','slide2_image','slide3_image'])if(payload[key]&&!imageURL(payload[key]))throw Error('קישור תמונה לא תקין.');
    const slug=form.elements.slug.value.trim();if(kind==='settings'&&slug!=='main')throw Error('מזהה הגדרות האתר חייב להיות main.');
    if(demo){const record={id:doc?.id||crypto.randomUUID(),kind,slug,data:payload,version:(doc?.version||0)+1,updated_at:new Date().toISOString()};documents=documents.filter(d=>d.id!==record.id).concat(record);if(kind==='products'&&!inventory.some(i=>i.product_id===record.id))inventory.push({product_id:record.id,quantity_kg:0,version:1});demoAudit(doc?'UPDATE':'INSERT','svk_drafts',record.id);}
    else await unwrap(db.rpc('svk_save_document',{p_id:doc?.id||null,p_kind:kind,p_slug:slug,p_data:payload,p_version:doc?.version||0}));
    await load();notice('הטיוטה נשמרה. האתר החי יתעדכן רק לאחר פרסום.');
  });
  if(doc)$('#editor-form').elements.slug.readOnly=true;
}
async function publish(id,publishNow,buttonEl){
  const doc=documents.find(d=>d.id===id);
  if(!confirm(publishNow?`לפרסם את "${doc.data.title}" באתר החי?`:`להסיר את "${doc.data.title}" מהאתר? הטיוטה תישמר.`))return;
  buttonEl.disabled=true;
  try{
    if(demo){published=published.filter(p=>p.id!==id);if(publishNow)published.push(structuredClone(doc));demoAudit(publishNow?'UPDATE':'DELETE','svk_published',id);}
    else await unwrap(db.rpc('svk_publish',{p_id:id,p_version:doc.version,p_publish:publishNow}));
    await load();render();notice(demo?'הפעולה בוצעה בהדגמה בלבד.':publishNow?'הפריט פורסם. השינויים יוצגו בטעינה הבאה של האתר.':'הפריט הוסר מהאתר.');
  }catch(e){notice(friendly(e),true);}finally{buttonEl.disabled=false;}
}
function preview(doc){
  const snapshot=published.filter(p=>p.id!==doc.id).concat(doc);
  // A product can be previewed before its parent category has been published.
  if(doc.kind==='products'&&!snapshot.some(item=>item.kind==='categories'&&item.slug===doc.data.category)){
    const category=documents.find(item=>item.kind==='categories'&&item.slug===doc.data.category);
    if(category)snapshot.push(category);
  }
  const url=doc.kind==='products'||doc.kind==='categories'?'sea.html?category='+encodeURIComponent(doc.kind==='products'?doc.data.category:doc.slug):doc.kind==='pages'?'page.html?slug='+encodeURIComponent(doc.slug):'index.html';
  const frame=$('#preview-frame');frame.src=url+(url.includes('?')?'&':'?')+'admin-preview=1';
  frame.onload=()=>frame.contentWindow.postMessage({type:'svk-preview',documents:snapshot},location.origin);
  $('#preview-dialog').showModal();
}
$('#close-preview').onclick=()=>{$('#preview-dialog').close();$('#preview-frame').src='about:blank';};
function openStock(item){openEditor('עדכון מלאי',[field(['quantity','מלאי זמין בקילוגרמים','number',true],item.quantity_kg)],async form=>{
  const value=Number(form.elements.quantity.value);if(value<0||!Number.isFinite(value))throw Error('יש להזין כמות תקינה.');
  if(demo){item.quantity_kg=value;item.version++;demoAudit('UPDATE','svk_inventory',item.product_id);}else await unwrap(db.rpc('svk_set_stock',{p_id:item.product_id,p_quantity:value,p_version:item.version}));await load();notice('המלאי עודכן.');
},'עדכון מלאי','השינוי משפיע מיד על המלאי הזמין');$('#editor-form').elements.quantity.step='.001';}
function openCustomer(customer){
  const fields=[['name','שם מלא','text',true],['phone','טלפון','tel',true],['email','אימייל','email'],['address','כתובת','text'],['notes','הערות פנימיות','textarea']];
  openEditor(customer?'עריכת לקוח':'לקוח חדש',fields.map(def=>field(def,customer?.[def[0]])),async form=>{
    const data=Object.fromEntries(fields.map(([key])=>[key,form.elements[key].value.trim()]));
    if(demo){if(customer)Object.assign(customer,data);else customers.push({...data,id:crypto.randomUUID(),created_at:new Date().toISOString()});demoAudit(customer?'UPDATE':'INSERT','svk_customers',customer?.id);}
    else await unwrap(customer?db.from('svk_customers').update(data).eq('id',customer.id).select().single():db.from('svk_customers').insert(data).select().single());
    await load();notice('פרטי הלקוח נשמרו.');
  },'שמירת לקוח','פרטי לקוח פנימיים · נשמרים מיד');
}
function openStaff(member){
  const role=document.createElement('label');role.textContent='תפקיד';const select=document.createElement('select');select.name='role';Object.entries(roles).forEach(([value,title])=>select.append(new Option(title,value)));select.value=member?.role||'content';role.append(select);
  openEditor('צוות והרשאות',[field(['user_id','מזהה משתמש קיים ב־Supabase Auth','text',true],member?.user_id),field(['display_name','שם לתצוגה','text',true],member?.display_name),role,field(['active','חשבון פעיל','checkbox'],member?.active??true)],async form=>{
    const id=form.elements.user_id.value.trim();if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('יש להזין מזהה משתמש תקין.');
    const record={user_id:id,display_name:form.elements.display_name.value.trim(),role:form.elements.role.value,active:form.elements.active.checked};
    if(demo){if(member?.role==='admin'&&member.active&&(record.role!=='admin'||!record.active)&&team.filter(m=>m.role==='admin'&&m.active).length<=1)throw Error('לא ניתן להשבית את המנהל האחרון.');team=team.filter(m=>m.user_id!==id).concat(record);demoAudit('UPDATE','svk_staff',id);}
    else await unwrap(db.rpc('svk_assign_staff',{p_user:id,p_name:record.display_name,p_role:record.role,p_active:record.active}));
    await load();if(id===staff.user_id&&!demo){location.reload();return;}notice('הרשאות המשתמש עודכנו.');
  },'שמירת הרשאות','יש להזמין את העובד ב־Supabase Auth לפני הענקת הרשאות');
  if(member)$('#editor-form').elements.user_id.readOnly=true;
}
function selectField(name,title,choices){const label=document.createElement('label');label.textContent=title;const select=document.createElement('select');select.name=name;select.required=true;select.append(new Option('בחירה…',''));choices.forEach(([id,text])=>select.append(new Option(text,id)));label.append(select);return label;}
function openOrder(){
  const products=published.filter(d=>d.kind==='products'&&d.data.active!==false),shipping=published.filter(d=>d.kind==='shipping'&&d.data.active!==false);
  if(!customers.length||!products.length||!shipping.length){notice('ליצירת הזמנה יש להוסיף לקוח, לפרסם מוצר ולהגדיר שיטת משלוח.',true);return;}
  const requestId=crypto.randomUUID();
  const customerField=selectField('customer','לקוח',customers.map(c=>[c.id,c.name+' · '+c.phone]));
  const shipmentField=selectField('shipping','משלוח / איסוף',shipping.map(s=>[s.id,s.data.title+' · '+money(s.data.price_cents)]));
  const add=button('הוספת שורת מוצר',()=>addLine(),'admin-secondary');add.type='button';add.classList.add('full-field');
  openEditor('הזמנה ידנית חדשה',[customerField,shipmentField,field(['address','כתובת מסירה','text']),field(['notes','הערות להזמנה','textarea']),add],async form=>{
    const lines=$$('.order-line',form).map(row=>({product_id:$('[name=product]',row).value,quantity_kg:Number($('[name=quantity]',row).value),cut:$('[name=cut]',row).value}));
    if(!lines.length||lines.some(l=>!l.product_id||l.quantity_kg<=0||!Number.isFinite(l.quantity_kg)||!l.cut))throw Error('יש למלא מוצר, כמות וחיתוך בכל שורה.');
    if(demo){
      const required=new Map();for(const line of lines)required.set(line.product_id,(required.get(line.product_id)||0)+line.quantity_kg);
      for(const [id,qty] of required)if(Number(inventory.find(i=>i.product_id===id)?.quantity_kg||0)<qty)throw Error('Insufficient stock');
      const shipment=shipping.find(s=>s.id===form.elements.shipping.value);const items=lines.map(line=>{const product=products.find(p=>p.id===line.product_id);return {...line,name:product.data.title,price_cents:product.data.price_cents,total_cents:Math.round(product.data.price_cents*line.quantity_kg)};});
      for(const [id,qty] of required){const stock=inventory.find(i=>i.product_id===id);stock.quantity_kg-=qty;stock.version++;}
      orders.unshift({id:requestId,number:Math.max(1000,...orders.map(o=>o.number))+1,customer_id:form.elements.customer.value,items,total_cents:items.reduce((n,l)=>n+l.total_cents,shipment.data.price_cents),shipping_cents:shipment.data.price_cents,shipping_name:shipment.data.title,fulfillment:shipment.data.method||(shipment.slug==='pickup'?'pickup':'delivery'),source:'admin',address:form.elements.address.value,notes:form.elements.notes.value,status:'new',created_at:new Date().toISOString()});demoAudit('INSERT','svk_orders',requestId);
    }else await unwrap(db.rpc('svk_create_order',{p_customer:form.elements.customer.value,p_items:lines,p_shipping:form.elements.shipping.value,p_address:form.elements.address.value,p_notes:form.elements.notes.value,p_request:requestId}));
    await load();notice('ההזמנה נוצרה והמלאי עודכן. לא בוצע חיוב כספי.');
  },'יצירת הזמנה','המחירים מחושבים בדטאבייס והמלאי מתעדכן ביצירת ההזמנה');
  customerField.querySelector('select').onchange=event=>{$('#editor-form').elements.address.value=customers.find(c=>c.id===event.target.value)?.address||'';};
  function addLine(){const row=document.createElement('div');row.className='order-line';row.append(selectField('product','מוצר',products.map(p=>[p.id,p.data.title+' · '+money(p.data.price_cents)+' לק״ג'])),field(['quantity','כמות בק״ג','number',true],1),selectField('cut','חיתוך',[]));$('[name=quantity]',row).min='.001';$('[name=quantity]',row).step='.001';$('[name=product]',row).onchange=event=>{const cuts=products.find(p=>p.id===event.target.value)?.data.cuts||[];$('[name=cut]',row).replaceChildren(...cuts.map(c=>new Option(c,c)));};const remove=button('הסרה',()=>row.remove(),'admin-secondary');remove.type='button';row.append(remove);$('#editor-fields').insertBefore(row,add);}
  addLine();
}
function viewOrder(order){
  const summary=document.createElement('div');summary.className='order-summary';const customer=customers.find(c=>c.id===order.customer_id);
  summary.innerHTML=`<p>${order.source==='storefront'?'הזמנה מהאתר':'הזמנה ידנית'}</p><strong>${h(customer?.name)} · ${h(customer?.phone)}</strong><p class="text-block">${h(order.address)}<br>${h(order.shipping_name)} · ${money(order.shipping_cents)}</p>${simpleTable(['מוצר','כמות','חיתוך','סכום'],order.items.map(i=>[h(i.name),h(i.quantity_kg)+' ק״ג',h(i.cut),money(i.total_cents)]))}<p><strong>סה״כ: ${money(order.total_cents)}</strong></p><p class="text-block">${h(order.notes)}</p>`;
  const pickup=order.fulfillment==='pickup';
  const next={new:'processing',processing:'ready',ready:pickup?'completed':'shipped',shipped:'completed'}[order.status];
  const orderStatus=v=>v==='ready'?(pickup?'מוכנה לאיסוף':'מוכנה למשלוח'):v==='completed'&&pickup?'נאספה והושלמה':statuses[v];
  const choices=[[order.status,orderStatus(order.status)],...(next?[[next,orderStatus(next)]]:[]),...(!['completed','cancelled'].includes(order.status)?[['cancelled','ביטול הזמנה והחזרת מלאי']]:[])];
  const status=selectField('status','סטטוס ההזמנה',choices);$('select',status).value=order.status;
  openEditor('הזמנה #'+order.number,[summary,status,field(['courier','שליח / חברת משלוחים','text'],order.courier),field(['tracking_code','מספר מעקב','text'],order.tracking_code),field(['delivery_date','תאריך אספקה מתוכנן','date'],order.delivery_date)],async form=>{
    const target=form.elements.status.value;if(target==='cancelled'&&!confirm('לבטל את ההזמנה ולהחזיר את המוצרים למלאי?'))return false;
    if(demo){if(target==='cancelled'&&order.status!=='cancelled')for(const line of order.items){const stock=inventory.find(i=>i.product_id===line.product_id);stock.quantity_kg+=line.quantity_kg;stock.version++;}Object.assign(order,{status:target,courier:form.elements.courier.value,tracking_code:form.elements.tracking_code.value,delivery_date:form.elements.delivery_date.value});demoAudit('UPDATE','svk_orders',order.id);}
    else await unwrap(db.rpc('svk_order_status',{p_id:order.id,p_status:target,p_courier:form.elements.courier.value,p_tracking:form.elements.tracking_code.value,p_date:form.elements.delivery_date.value||null}));await load();notice('ההזמנה עודכנה.');
  },'עדכון הזמנה','עדכון תפעולי בלבד · ללא שינוי מצב תשלום');
}
async function importSeed(){
  if(!confirm('לייבא את הקטלוג הקיים ואת הגדרות האתר כטיוטות בלבד? המחירים והמוצרים הם נתוני הדגמה, והמלאי יתחיל באפס.'))return;
  try{for(const item of seed){if(documents.some(d=>d.kind===item.kind&&d.slug===item.slug))continue;await unwrap(db.rpc('svk_save_document',{p_id:null,p_kind:item.kind,p_slug:item.slug,p_data:item.data,p_version:0}));}await load();render();notice('הקטלוג יובא כטיוטות. בדוק מחירים, תמונות ומשלוחים, עדכן מלאי ופרסם את הפריטים המתאימים.');}catch(e){await load().catch(()=>{});render();notice(friendly(e),true);}
}
$('#editor-form').onsubmit=async event=>{event.preventDefault();const save=$('#save-editor');save.disabled=true;$('#editor-error').textContent='';try{const result=await editor(event.currentTarget);if(result!==false){$('#editor-dialog').close();render();}}catch(e){$('#editor-error').textContent=friendly(e);}finally{save.disabled=false;}};
$$('[data-close]').forEach(b=>b.onclick=()=>$('#editor-dialog').close());
$('#login-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,status=$('#login-status'),submit=$('button',form);submit.disabled=true;status.classList.remove('error');status.textContent='';
  try{
    if(!db)throw Error('ספריית ההתחברות לא נטענה. יש לרענן את העמוד.');
    const username=form.elements.username.value.trim().toLowerCase();
    if(!username.includes('@')&&!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(username))throw Error('יש להזין שם משתמש באנגלית או כתובת אימייל תקינה.');
    const email=username.includes('@')?username:username+'@staff.snapirvekaskeset.invalid';
    await unwrap(db.auth.signInWithPassword({email,password:form.elements.password.value}));
    form.elements.password.value='';await start();
  }catch(e){status.classList.add('error');status.textContent=friendly(e);}finally{submit.disabled=false;}
};
$('#change-password').onclick=()=>{
  if(demo){notice('שינוי סיסמה זמין לאחר כניסה לחשבון אמיתי.');return;}
  const fields=[field(['current','סיסמה נוכחית','password',true]),field(['next','סיסמה חדשה','password',true]),field(['confirm','אימות סיסמה חדשה','password',true])];
  for(const label of fields){const input=$('input',label);input.dir='ltr';input.autocomplete=input.name==='current'?'current-password':'new-password';if(input.name!=='current')input.minLength=8;}
  openEditor('שינוי הסיסמה שלי',fields,async form=>{
    if(form.elements.next.value!==form.elements.confirm.value)throw Error('הסיסמאות החדשות אינן תואמות.');
    const session=await unwrap(db.auth.getSession());if(!session.session?.user?.email)throw Error('יש להתחבר מחדש כדי לשנות סיסמה.');
    await unwrap(db.auth.signInWithPassword({email:session.session.user.email,password:form.elements.current.value}));
    await unwrap(db.auth.updateUser({password:form.elements.next.value}));
    form.reset();notice('הסיסמה שלך עודכנה בהצלחה.');
  },'עדכון הסיסמה','שינוי הסיסמה של החשבון המחובר בלבד');
};
$('#logout').onclick=async()=>{if(!demo){const result=await db.auth.signOut();if(result.error){notice(friendly(result.error),true);return;}}location.href='admin.html';};
async function start(){
  try{
    seed=await fetch('admin-seed.json').then(r=>{if(!r.ok)throw Error('לא ניתן לטעון את קטלוג ההתחלה.');return r.json();});
    if(local){
      await load();staff=team[0];$('#demo-banner').hidden=false;$('#demo-banner').textContent='סביבת בדיקה מקומית בלבד · ההזמנות משותפות לחנות המקומית ונשמרות בדפדפן · אין שינוי בחנות החיה';$('#connection-label').textContent='חנות בדיקה מקומית';
    }else if(demo){
      staff={user_id:crypto.randomUUID(),display_name:'מנהל הדגמה',role:'admin',active:true};team=[staff];documents=structuredClone(seed);published=structuredClone(seed);inventory=documents.filter(d=>d.kind==='products').map(d=>({product_id:d.id,quantity_kg:20,version:1}));
      customers=[{id:crypto.randomUUID(),name:'לקוח לדוגמה',phone:'050-0000000',email:'demo@example.com',address:'כתובת לדוגמה בלבד',notes:'נתוני הדגמה'}];
      const product=published.find(d=>d.kind==='products');orders=[{id:crypto.randomUUID(),number:1001,customer_id:customers[0].id,items:[{product_id:product.id,name:product.data.title,quantity_kg:1,cut:product.data.cuts[0],price_cents:product.data.price_cents,total_cents:product.data.price_cents}],total_cents:product.data.price_cents,shipping_cents:0,shipping_name:'איסוף עצמי',address:'כתובת לדוגמה בלבד',notes:'הזמנה לדוגמה בלבד',status:'new',created_at:new Date().toISOString()}];inventory.find(i=>i.product_id===product.id).quantity_kg-=1;
      $('#demo-banner').hidden=false;$('#connection-label').textContent='נתוני הדגמה בלבד';
    }else{
      if(!db)throw Error('ספריית ההתחברות לא נטענה.');const session=await unwrap(db.auth.getSession());if(!session.session)return;
      staff=await unwrap(db.from('svk_staff').select('*').eq('user_id',session.session.user.id).maybeSingle());
      if(!staff?.active)throw Error('החשבון מחובר אך אין לו הרשאה לניהול החנות. יש לבקש ממנהל החנות הרשאה.');
      await load();
      db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')location.href='admin.html';});
    }
    $('#login-view').hidden=true;$('#admin-app').hidden=false;$('#staff-label').textContent=staff.display_name+' · '+roles[staff.role];
    $('#admin-nav').innerHTML=allowed().map(key=>`<button data-section="${key}">${icon(key)}${h(labels[key])}</button>`).join('');
    $$('#admin-nav button').forEach(b=>b.onclick=()=>navigate(b.dataset.section));
    section=allowed().includes(location.hash.slice(1))?location.hash.slice(1):'dashboard';render();
    if(local)window.addEventListener('storage',async e=>{if(e.key==='snapir-local-store-v1'&&!$('#editor-dialog').open){await load();render();}});
    window.addEventListener('hashchange',()=>{const key=location.hash.slice(1);if(key!==section&&allowed().includes(key)){section=key;pageIndex=0;search='';render();}});
  }catch(e){$('#login-status').textContent=friendly(e);$('#login-status').classList.add('error');}
}
start();
})();
