const products = [...document.querySelectorAll('.product')];
const dots = document.querySelector('.dots');
const query = document.querySelector('.search input');
const categoryLinks = [...document.querySelectorAll('.category')];
const categoryGrid = document.querySelector('.category-grid');
const panel = document.querySelector('#panel');
const panelBody = panel.querySelector('.panel-body');
const toast = document.querySelector('.toast');
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const readStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const store = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* Interaction still works when storage is not available. */ }
};
const savedCart = readStorage('sf-cart', {});
const cart = Object.fromEntries(Object.entries(savedCart && typeof savedCart === 'object' ? savedCart : {})
  .filter(([id, quantity]) => products.some(product => product.dataset.id === id)
    && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 99));
const cartDrawer = document.querySelector('#cart-drawer');
const cartList = cartDrawer.querySelector('.cart-items');
const floatingCart = document.querySelector('.cart-float');
const cartClose = cartDrawer.querySelector('.cart-close');
const cartTemplate = document.querySelector('#cart-row');
const cartTriggers = [document.querySelector('.cart'), floatingCart];
let cartOpener;
let cartScrollY = 0;
let cartCloseTimer;
let cartBodyStyles;
const favorites = new Set(readStorage('sf-favorites', []));
const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' });
let category = null;
let salesOnly = false;
let visibleProducts = products;
let current = 1;
let toastTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2100);
}

function showSlide(index) {
  current = visibleProducts.length ? (index + visibleProducts.length) % visibleProducts.length : 0;
  products.forEach(product => product.classList.toggle('current', product === visibleProducts[current]));
  [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
}

function updateProducts() {
  const term = query.value.trim().toLocaleLowerCase('he');
  visibleProducts = products.filter(product => {
    const name = product.querySelector('h3').textContent;
    const text = product.querySelector('.product-details p').textContent;
    return (category === null || product.dataset.category === category)
      && (!salesOnly || product.querySelector('.sale'))
      && (name + ' ' + text).toLocaleLowerCase('he').includes(term);
  });
  products.forEach(product => product.hidden = !visibleProducts.includes(product));
  document.querySelector('.empty').hidden = visibleProducts.length !== 0;
  document.querySelectorAll('.carousel-arrow').forEach(arrow => arrow.hidden = visibleProducts.length < 2);
  dots.replaceChildren(...visibleProducts.slice(0, visibleProducts.length > 1 ? undefined : 0).map((product, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', product.querySelector('h3').textContent);
    dot.addEventListener('click', () => showSlide(i));
    return dot;
  }));
  showSlide(!term && category === null && !salesOnly ? 1 : 0);
  categoryLinks.forEach(link => link.classList.toggle('selected', link.dataset.category === category));
}

function updateCart() {
  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  document.querySelector('.cart-count').textContent = count;
  document.querySelector('.cart').setAttribute('aria-label', 'סל הקניות, ' + count + ' יחידות');
  floatingCart.hidden = count === 0;
  document.body.classList.toggle('has-floating-cart', count > 0);
  floatingCart.querySelector('.cart-float-count').textContent = count;
  const total = products.reduce((sum, product) => sum + (cart[product.dataset.id] || 0) * Number(product.dataset.price), 0);
  floatingCart.querySelector('.cart-float-total').textContent = money.format(total);
  floatingCart.setAttribute('aria-label', 'פתיחת סל הקניות, ' + count + ' יחידות, ' + money.format(total));
  store('sf-cart', cart);
  renderCart();
}

function openPanel(title) {
  panel.querySelector('h2').textContent = title;
  panelBody.replaceChildren();
  if (!panel.open) panel.showModal();
}

function renderCart() {
  const focused = cartList.contains(document.activeElement) ? document.activeElement : null;
  const focusedId = focused?.closest('li')?.dataset.product;
  const focusedAction = focused?.dataset.action;
  let nextFocus;
  const rows = document.createDocumentFragment();
  let sum = 0;
  products.filter(product => cart[product.dataset.id]).forEach(product => {
    const id = product.dataset.id;
    const name = product.querySelector('h3').textContent;
    const subtotal = cart[id] * Number(product.dataset.price);
    sum += subtotal;
    const row = cartTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.product = id;
    row.querySelector('img').src = product.querySelector('img').getAttribute('src');
    row.querySelector('strong').textContent = name;
    row.querySelector('.cart-weight').textContent = 'כמות בק״ג';
    row.querySelector('.cart-quantity').textContent = cart[id];
    row.querySelector('bdi').textContent = money.format(subtotal);
    row.querySelector('[data-action="decrease"]').setAttribute('aria-label', 'הפחתת כמות של ' + name);
    row.querySelector('[data-action="increase"]').setAttribute('aria-label', 'הגדלת כמות של ' + name);
    row.querySelector('[data-action="increase"]').disabled = cart[id] >= 99;
    row.querySelector('[data-action="remove"]').setAttribute('aria-label', 'הסרת ' + name + ' מהסל');
    if (id === focusedId) nextFocus = row.querySelector('[data-action="' + focusedAction + '"]');
    rows.append(row);
  });
  cartList.replaceChildren(rows);
  cartDrawer.querySelector('.cart-empty').hidden = cartList.children.length > 0;
  cartDrawer.querySelector('.cart-summary').hidden = cartList.children.length === 0;
  cartDrawer.querySelector('.cart-total').textContent = money.format(sum);
  if (focused) (nextFocus || cartList.querySelector('button') || cartClose).focus();
}

function showCart() {
  if (cartDrawer.open) return;
  cartOpener = document.activeElement;
  cartScrollY = window.scrollY;
  cartBodyStyles = ['position', 'top', 'width', 'overflow'].map(property => document.body.style[property]);
  Object.assign(document.body.style, { position: 'fixed', top: '-' + cartScrollY + 'px', width: '100%', overflow: 'hidden' });
  cartDrawer.classList.remove('is-closing');
  cartDrawer.showModal();
  cartTriggers.forEach(trigger => trigger.setAttribute('aria-expanded', 'true'));
}

function closeCart() {
  if (!cartDrawer.open || cartDrawer.classList.contains('is-closing')) return;
  cartDrawer.classList.add('is-closing');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) cartDrawer.close();
  else cartCloseTimer = setTimeout(() => cartDrawer.close(), 220);
}

cartTriggers.forEach(trigger => {
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'cart-drawer');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', showCart);
});
cartClose.addEventListener('click', closeCart);
cartDrawer.addEventListener('cancel', event => { event.preventDefault(); closeCart(); });
let cartBackdropPointer = false;
cartDrawer.addEventListener('pointerdown', event => {
  const bounds = cartDrawer.getBoundingClientRect();
  cartBackdropPointer = event.target === cartDrawer && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
});
cartDrawer.addEventListener('click', event => {
  const bounds = cartDrawer.getBoundingClientRect();
  if (cartBackdropPointer && event.target === cartDrawer && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeCart();
  cartBackdropPointer = false;
});
cartDrawer.addEventListener('close', () => {
  clearTimeout(cartCloseTimer);
  cartDrawer.classList.remove('is-closing');
  ['position', 'top', 'width', 'overflow'].forEach((property, index) => { document.body.style[property] = cartBodyStyles[index]; });
  window.scrollTo({ top: cartScrollY, behavior: 'instant' });
  cartTriggers.forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
  const target = cartOpener?.isConnected && !cartOpener.hidden ? cartOpener : document.querySelector('.cart');
  target.focus({ preventScroll: true });
});
cartList.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.closest('li').dataset.product;
  const quantity = button.dataset.action === 'remove' ? 0 : cart[id] + (button.dataset.action === 'increase' ? 1 : -1);
  if (quantity > 99) return;
  if (quantity > 0) cart[id] = quantity;
  else delete cart[id];
  updateCart();
  notify(quantity > 0 ? 'כמות המוצר עודכנה' : 'המוצר הוסר מהעגלה');
});

products.forEach(product => {
  const id = product.dataset.id;
  const favorite = product.querySelector('.favorite');
  favorite.setAttribute('aria-pressed', String(favorites.has(id)));
  favorite.addEventListener('click', () => {
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    favorite.setAttribute('aria-pressed', String(favorites.has(id)));
    store('sf-favorites', [...favorites]);
  });
  product.querySelector('.add').addEventListener('click', () => {
    const wasEmpty = Object.keys(cart).length === 0;
    const quantity = (cart[id] || 0) + Number(product.querySelector('select').value);
    if (quantity > 99) { notify('אפשר להוסיף עד 99 ק״ג מכל מוצר'); return; }
    cart[id] = quantity;
    updateCart();
    notify('המוצר נוסף לעגלה');
    if (wasEmpty) showCart();
  });
});
categoryLinks.forEach(link => link.addEventListener('click', () => {
  category = link.dataset.category;
  salesOnly = false;
  query.value = '';
  updateProducts();
}));
document.querySelectorAll('[data-reset]').forEach(link => link.addEventListener('click', event => {
  if (link.closest('.categories') && matchMedia('(max-width: 700px)').matches) {
    event.preventDefault();
    const expanded = categoryGrid.classList.toggle('expanded');
    link.setAttribute('aria-expanded', String(expanded));
  }
  category = null;
  salesOnly = false;
  query.value = '';
  updateProducts();
}));
document.querySelector('[data-sale]').addEventListener('click', () => {
  category = null;
  salesOnly = true;
  query.value = '';
  updateProducts();
});
document.querySelector('.search').addEventListener('submit', event => {
  event.preventDefault();
  category = null;
  salesOnly = false;
  updateProducts();
  document.querySelector('#products').scrollIntoView();
});
document.querySelector('.prev').addEventListener('click', () => showSlide(current - 1));
document.querySelector('.next').addEventListener('click', () => showSlide(current + 1));
menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(navigation.classList.toggle('open'))));
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
}));
document.querySelector('.account').addEventListener('click', () => {
  openPanel('המועדפים שלי');
  const names = products.filter(product => favorites.has(product.dataset.id))
    .map(product => product.querySelector('h3').textContent);
  panelBody.textContent = names.length ? names.join(' · ') : 'אין עדיין מוצרים במועדפים.';
});
document.querySelectorAll('[data-info]').forEach(button => button.addEventListener('click', () => {
  openPanel(button.dataset.info);
  panelBody.textContent = 'המידע יופיע כאן כשיוזן תוכן החנות.';
}));
document.querySelector('.story-toggle').addEventListener('click', event => {
  const about = document.querySelector('.about');
  const expanded = about.classList.toggle('expanded');
  event.currentTarget.setAttribute('aria-expanded', String(expanded));
  event.currentTarget.innerHTML = expanded ? 'קראו פחות <span>↑</span>' : 'קראו עוד <span>←</span>';
  if (!matchMedia('(max-width: 700px)').matches) {
    const description = about.querySelector('.about-description');
    if (expanded) {
      const extra = document.createElement('p');
      extra.className = 'about-description extra-story';
      extra.textContent = 'בחנות תמצאו דגים שלמים, פילה, רכיכות ופירות ים. את ההזמנה אפשר להרכיב לפי סוג הדג והכמות שמתאימה לכם.';
      description.after(extra);
    } else about.querySelector('.extra-story')?.remove();
  }
});
document.querySelector('.newsletter').addEventListener('submit', event => {
  event.preventDefault();
  store('sf-newsletter-email', document.querySelector('#email').value);
  notify('כתובת המייל נשמרה במכשיר');
  event.currentTarget.reset();
});
updateProducts();
updateCart();
