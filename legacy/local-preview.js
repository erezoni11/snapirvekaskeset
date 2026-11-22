// Explicit localhost-only sandbox. Never reads or writes the live store database.
(() => {
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))return;
  const params=new URLSearchParams(location.search);
  if(params.get('local-orders')==='1')sessionStorage.setItem('snapir-local-orders','1');
  if(params.get('local-orders')==='0')sessionStorage.removeItem('snapir-local-orders');
  if(sessionStorage.getItem('snapir-local-orders')!=='1')return;
  const key='snapir-local-store-v1';
  const read=()=>JSON.parse(localStorage.getItem(key));
  const write=data=>localStorage.setItem(key,JSON.stringify(data));
  const ready=fetch('admin-seed.json').then(r=>{if(!r.ok)throw Error('טעינת סביבת הבדיקה נכשלה');return r.json();}).then(seed=>{
    if(read())return;
    const documents=structuredClone(seed);
    documents.filter(d=>d.kind==='products').forEach(d=>d.data.featured=true);
    documents.filter(d=>d.kind==='shipping').forEach(d=>{d.data.method=d.slug==='pickup'?'pickup':'delivery';d.data.region=d.slug==='pickup'?'כתובת החנות לדוגמה':'אזור חלוקה לדוגמה';d.data.eta='בתיאום עם החנות';});
    write({version:1,documents,published:structuredClone(documents),inventory:documents.filter(d=>d.kind==='products').map(d=>({product_id:d.id,quantity_kg:20,version:1})),customers:[],orders:[],team:[{user_id:crypto.randomUUID(),display_name:'מנהל בדיקה מקומית',role:'admin',active:true}],audit:[]});
  });
  const receipt=o=>({order_id:o.id,number:o.number,total_cents:o.total_cents,shipping_cents:o.shipping_cents,shipping_name:o.shipping_name,status:o.status,fulfillment:o.fulfillment});
  async function checkout(p){
    return navigator.locks.request('snapir-local-checkout',async()=>{
      const state=read(),fingerprint=JSON.stringify(p),previous=state.orders.find(o=>o.id===p.p_request);
      if(previous){if(previous.checkout_fingerprint!==fingerprint)throw Error('Request conflict');return receipt(previous);}
      const shipment=state.published.find(d=>d.id===p.p_shipping&&d.kind==='shipping'&&d.data.active!==false);
      if(!shipment)throw Error('Select a published delivery method');
      if(!p.p_customer?.name?.trim()||!/^0[0-9]{8,9}$/.test(p.p_customer?.phone||''))throw Error('Invalid customer');
      const method=shipment.data.method||(shipment.slug==='pickup'?'pickup':'delivery');
      const a=p.p_address||{};
      if(method==='delivery'&&(!a.city?.trim()||!a.street?.trim()||!a.house?.trim()))throw Error('Delivery address required');
      if(!Array.isArray(p.p_items)||!p.p_items.length||p.p_items.length>100)throw Error('Invalid order items');
      let total=Number(shipment.data.price_cents);const items=[];
      for(const line of p.p_items){
        const product=state.published.find(d=>d.id===line.product_id&&d.kind==='products'&&d.data.active!==false);
        if(!product||!state.published.some(d=>d.kind==='categories'&&d.slug===product.data.category&&d.data.active!==false))throw Error('Product unavailable');
        if(!Number.isInteger(line.amount)||line.amount<1||line.amount>99||!(product.data.weights||[]).includes(line.weight_kg))throw Error('Invalid quantity');
        if(!product.data.cuts.includes(line.cut))throw Error('Invalid cut');
        const quantity=Math.round(line.amount*line.weight_kg*1000)/1000,stock=state.inventory.find(s=>s.product_id===product.id);
        if(!stock||stock.quantity_kg<quantity)throw Error('Insufficient stock: '+product.data.title);
        const lineTotal=Math.round(product.data.price_cents*quantity);total+=lineTotal;
        items.push({product_id:product.id,name:product.data.title,quantity_kg:quantity,cut:line.cut,price_cents:product.data.price_cents,total_cents:lineTotal});
        stock.quantity_kg=Math.round((stock.quantity_kg-quantity)*1000)/1000;stock.version++;
      }
      if(total!==p.p_expected_total)throw Error('Price changed');
      const address=method==='pickup'?shipment.data.region:[a.city,a.street,a.house,a.apartment&&'דירה '+a.apartment].filter(Boolean).join(', ');
      const customer={id:crypto.randomUUID(),...p.p_customer,address,created_at:new Date().toISOString()};
      const order={id:p.p_request,number:Math.max(1000,...state.orders.map(o=>o.number))+1,customer_id:customer.id,items,total_cents:total,shipping_cents:shipment.data.price_cents,shipping_name:shipment.data.title,address,notes:p.p_notes||'',fulfillment:method,source:'storefront',status:'new',created_at:new Date().toISOString(),checkout_fingerprint:fingerprint};
      state.customers.push(customer);state.orders.unshift(order);state.version++;state.audit.unshift({id:Date.now(),action:'INSERT',resource:'svk_orders',resource_id:order.id,created_at:order.created_at});write(state);
      return receipt(order);
    });
  }
  window.snapirLocalPreview={ready,read,save(patch,version){const state=read();if(state.version!==version)throw Error('Inventory changed. Reload before saving.');write({...state,...patch,version:version+1});},client:{rpc:async(name,args)=>{
    try{await ready;if(name==='svk_checkout')return {data:await checkout(args),error:null};if(name==='svk_catalog'){const s=read();return {data:s.published.map(d=>({...d,available_kg:s.inventory.find(i=>i.product_id===d.id)?.quantity_kg||0})),error:null};}throw Error('Unsupported local RPC');}catch(e){return {data:null,error:{message:e.message}};}
  }}};
  // Supabase's query builder supports abortSignal; retain that small contract here.
  const rpc=window.snapirLocalPreview.client.rpc;
  window.snapirLocalPreview.client.rpc=(...args)=>{const result=rpc(...args);result.abortSignal=()=>result;return result;};
  const banner=document.createElement('div');banner.className='local-preview-banner';banner.dir='rtl';
  banner.innerHTML='סביבת בדיקה מקומית · נתוני דוגמה בלבד · לא נשלח לחנות החיה <a href="admin.html?local-orders=1#orders">ניהול הזמנות הבדיקה</a> <a href="index.html?local-orders=0">יציאה ממצב בדיקה</a>';
  document.body.prepend(banner);
})();
