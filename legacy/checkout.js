(() => {
  const $=s=>document.querySelector(s),form=$('#checkout-form'),api=window.supabaseClient;
  const currency=n=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'}).format(n/100);
  const cart=window.snapirCart.get();
  const receiptKey=window.snapirLocalPreview?'snapir-local-receipt':'snapir-receipt';
  const pendingKey=receiptKey+'-pending';
  let step=1,catalog=[],shipping=[],selected=null,total=0,subtotal=0,valid=false,busy=false,request=null;
  const value=name=>form.elements[name].value.trim();
  const error=text=>{const el=$('#checkout-error');el.textContent=text;el.hidden=!text;if(text)el.focus();};
  function friendly(e){
    const text=e?.message||String(e);
    if(/Insufficient stock|Product unavailable/.test(text))return 'המלאי של אחד המוצרים השתנה. חזרו לסל ועדכנו את הבחירה לפני שליחה.';
    if(/Price changed/.test(text))return 'המחירים השתנו מאז הבדיקה. רעננו את העמוד, בדקו את הסכום החדש ושלחו שוב.';
    if(/Too many/.test(text))return 'נשלחו כמה הזמנות בזמן קצר. המתינו מעט לפני ניסיון נוסף.';
    if(/PGRST202|function.*does not exist|schema cache/i.test(text+' '+e?.code))return 'שליחת הזמנות טרם הופעלה בסביבה הזו. אפשר לבדוק את התהליך בסביבה המקומית המבודדת.';
    return 'השליחה לא הושלמה. הסל נשמר. בדקו את החיבור ונסו שוב; ניסיון חוזר לא ייצור הזמנה כפולה.';
  }
  async function loadCatalog(){
    if(!api)throw Error('No connection');
    const {data,error}=await api.rpc('svk_catalog');if(error)throw error;
    if(!Array.isArray(data))throw Error('Invalid catalog');catalog=data;
  }
  const productFor=item=>catalog.find(d=>d.id===item.productId&&d.kind==='products'&&d.data.active!==false&&catalog.some(c=>c.kind==='categories'&&c.slug===d.data.category&&c.data.active!==false));
  function summary(){
    const list=$('#checkout-items');list.replaceChildren();subtotal=0;valid=cart.length>0;
    const required=new Map();
    for(const item of cart){
      const product=productFor(item),weight=Number(item.weightKg),qty=Math.round(weight*item.amount*1000)/1000;
      if(!product||!Number.isInteger(item.amount)||item.amount<1||item.amount>99||!product.data.weights?.includes(weight)||!product.data.cuts?.includes(item.cut)){valid=false;continue;}
      required.set(product.id,(required.get(product.id)||0)+qty);
      if(required.get(product.id)>Number(product.available_kg||0))valid=false;
      const price=Math.round(Number(product.data.price_cents)*qty);subtotal+=price;
      const row=document.createElement('div');row.className='checkout-item';
      const image=document.createElement('img');image.src=new URL(product.data.image||'assets/logo.png',location.href).href;image.alt='';
      if(!['http:','https:'].includes(new URL(image.src).protocol))image.src='assets/logo.png';
      const details=document.createElement('div'),title=document.createElement('h3'),meta=document.createElement('p'),cost=document.createElement('strong');
      title.textContent=product.data.title;meta.textContent=`${item.amount} × ${weight} ק״ג · ${item.cut}`;cost.textContent=currency(price);
      details.append(title,meta,cost);row.append(image,details);list.append(row);
    }
    total=subtotal+Number(selected?.data.price_cents||0);
    $('#checkout-subtotal').textContent=currency(subtotal);$('#checkout-total').textContent=currency(total);
    $('#checkout-shipping').textContent=selected?currency(selected.data.price_cents):'ייבחר בהמשך';
    $('#checkout-next').disabled=!valid;$('#checkout-submit').disabled=!valid||!selected||busy;
    if(!valid)error(cart.length?'יש בסל מוצר שאינו זמין או כמות שאינה במלאי. חזרו לחנות ועדכנו את הסל.':'הסל ריק. בחרו מוצרים בחנות כדי להמשיך להזמנה.');
    return valid;
  }
  const method=shipment=>shipment?.data.method||(shipment?.slug==='pickup'?'pickup':'delivery');
  function selectShipment(shipment){
    selected=shipment;
    const delivery=method(shipment)==='delivery';$('#delivery-address').hidden=!delivery;
    ['city','street','house','apartment'].forEach(name=>form.elements[name].disabled=step!==2||!delivery);
    summary();
  }
  function showStep(next){
    step=next;error('');
    document.querySelectorAll('[data-checkout-step]').forEach(el=>{el.hidden=Number(el.dataset.checkoutStep)!==step;el.disabled=el.hidden;});
    document.querySelectorAll('.checkout-steps li').forEach((li,i)=>{if(i+1===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
    $('#checkout-prev').hidden=step===1;$('#checkout-next').hidden=step===3;$('#checkout-submit').hidden=step!==3;
    if(selected)selectShipment(selected);
    if(step===3){
      const review=$('#checkout-review');review.replaceChildren();
      const entries=[['פרטי קשר',value('customer_name')+' · '+value('phone')],['קבלת ההזמנה',selected.data.title+' · '+(method(selected)==='pickup'?selected.data.region:[value('city'),value('street'),value('house'),value('apartment')].filter(Boolean).join(', '))],['הערות לחנות',value('notes')||'ללא הערות'],['סה״כ לאישור, כולל משלוח / איסוף',currency(total)]];
      for(const [label,text] of entries){const h=document.createElement('h3'),p=document.createElement('p');h.textContent=label;p.textContent=text;review.append(h,p);}
    }
    const field=document.querySelector(`[data-checkout-step="${step}"]`);field.tabIndex=-1;field.focus();
  }
  $('#checkout-prev').onclick=()=>showStep(step-1);
  $('#checkout-next').onclick=()=>{
    if(!form.reportValidity())return;
    if(step===1){const phone=value('phone').replace(/[^0-9]/g,'').replace(/^972/,'0');if(!/^0[0-9]{8,9}$/.test(phone)){error('יש להזין מספר טלפון ישראלי תקין.');return;}}
    if(step===2&&!selected){error('בחרו משלוח או איסוף עצמי כדי להמשיך.');return;}
    showStep(step+1);
  };
  function success(receipt){
    $('#checkout-flow').hidden=true;$('#checkout-success').hidden=false;
    $('#receipt-number').textContent=`מספר ההזמנה: #${receipt.number} · סה״כ ${currency(receipt.total_cents)}`;
    $('#receipt-shipping').textContent=receipt.fulfillment==='pickup'?'בחרתם איסוף עצמי. נא להמתין לאישור שההזמנה מוכנה לפני הגעה לחנות.':'בחרתם '+receipt.shipping_name+'. מועד המשלוח יתואם לאחר אישור החנות.';
    $('#receipt-admin').hidden=!window.snapirLocalPreview;
    $('#checkout-success').focus();
  }
  form.onsubmit=async event=>{
    event.preventDefault();if(busy)return;if(step!==3){$('#checkout-next').click();return;}if(!form.reportValidity()||!selected)return;
    busy=true;$('#checkout-prev').disabled=true;$('#checkout-submit').disabled=true;$('#checkout-submit').textContent='שולחים את ההזמנה…';error('');
    try{
      // A retry after an uncertain response reuses the exact request and UUID.
      if(!request){
        const previous=total;await loadCatalog();selected=catalog.find(d=>d.id===selected.id&&d.kind==='shipping'&&d.data.active!==false);
        if(!selected)throw Error('Delivery unavailable');if(!summary())return;
        if(total!==previous){error('המחיר עודכן. בדקו את הסכום החדש ולחצו שוב לשליחה.');return;}
        request={p_customer:{name:value('customer_name'),phone:value('phone').replace(/[^0-9]/g,'').replace(/^972/,'0'),email:value('email')},p_items:cart.map(i=>({product_id:i.productId,weight_kg:i.weightKg,amount:i.amount,cut:i.cut})),p_shipping:selected.id,p_address:{city:value('city'),street:value('street'),house:value('house'),apartment:value('apartment')},p_notes:value('notes'),p_request:crypto.randomUUID(),p_expected_total:total};
        sessionStorage.setItem(pendingKey,JSON.stringify(request));
      }
      const {data,error:problem}=await api.rpc('svk_checkout',request);if(problem)throw problem;
      if(!data?.order_id||!Number.isSafeInteger(Number(data.number))||!Number.isSafeInteger(Number(data.total_cents)))throw Error('Invalid confirmation');
      window.snapirCart.clear();try{sessionStorage.setItem(receiptKey,JSON.stringify(data));sessionStorage.removeItem(pendingKey);}catch{}
      location.hash='thank-you';success(data);
    }catch(e){if(/Price changed|Insufficient stock|Product unavailable|PGRST202|Delivery unavailable/.test((e?.message||'')+' '+e?.code)){request=null;sessionStorage.removeItem(pendingKey);}error(friendly(e));}finally{busy=false;$('#checkout-prev').disabled=!!request;$('#checkout-submit').disabled=(!valid&&!request)||!selected;$('#checkout-submit').textContent='שליחת הזמנה לחנות ←';}
  };
  // Editing a failed submission requires a new idempotency key.
  form.addEventListener('input',event=>{if(event.target.name==='confirmed')return;request=null;sessionStorage.removeItem(pendingKey);});
  async function start(){
    if(location.hash==='#thank-you'&&!cart.length){try{const saved=JSON.parse(sessionStorage.getItem(receiptKey));if(saved?.number){success(saved);return;}}catch{}}
    try{
      await loadCatalog();summary();shipping=catalog.filter(d=>d.kind==='shipping'&&d.data.active!==false).sort((a,b)=>(a.data.position||0)-(b.data.position||0));
      if(!shipping.length){valid=false;$('#checkout-next').disabled=true;error('עדיין לא פורסמו אפשרויות משלוח או איסוף עצמי. יש להגדיר ולפרסם אותן באדמין לפני קבלת הזמנות.');return;}
      const host=$('#shipping-choices');
      for(const shipment of shipping){
        const label=document.createElement('label');label.className='shipping-choice';
        const radio=document.createElement('input');radio.type='radio';radio.name='shipping';radio.value=shipment.id;radio.required=true;
        const content=document.createElement('span'),title=document.createElement('b'),region=document.createElement('small'),eta=document.createElement('small');
        title.textContent=shipment.data.title+' · '+currency(shipment.data.price_cents);region.textContent=shipment.data.region||'';eta.textContent=shipment.data.eta||'בתיאום עם החנות';content.append(title,region,eta);label.append(radio,content);host.append(label);radio.onchange=()=>selectShipment(shipment);
      }
      const preferred=sessionStorage.getItem('snapir-fulfillment');
      const initial=shipping.find(s=>method(s)===preferred)||shipping[0];host.querySelector(`input[value="${initial.id}"]`).checked=true;selectShipment(initial);
      try{
        const pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null');
        if(pending&&JSON.stringify(pending.p_items)===JSON.stringify(cart.map(i=>({product_id:i.productId,weight_kg:i.weightKg,amount:i.amount,cut:i.cut})))&&shipping.some(s=>s.id===pending.p_shipping)){
          form.elements.customer_name.value=pending.p_customer.name;form.elements.phone.value=pending.p_customer.phone;form.elements.email.value=pending.p_customer.email;
          for(const name of ['city','street','house','apartment'])form.elements[name].value=pending.p_address[name]||'';
          form.elements.notes.value=pending.p_notes;selected=shipping.find(s=>s.id===pending.p_shipping);host.querySelector(`input[value="${selected.id}"]`).checked=true;
          request=pending;showStep(3);$('#checkout-prev').disabled=true;$('#checkout-submit').disabled=false;
          error('נשמר ניסיון שליחה קודם. לחיצה על שליחה תבדוק אותו שוב עם אותו מספר בקשה, ללא יצירת הזמנה כפולה.');
        }
      }catch{}
    }catch(e){error(friendly(e));}
  }
  start();
})();
