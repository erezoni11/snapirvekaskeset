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
const cart = readStorage('sf-cart', {});
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
  store('sf-cart', cart);
}

function openPanel(title) {
  panel.querySelector('h2').textContent = title;
  panelBody.replaceChildren();
  if (!panel.open) panel.showModal();
}

function showCart() {
  openPanel('סל הקניות');
  const list = document.createElement('ul');
  let sum = 0;
  products.filter(product => cart[product.dataset.id]).forEach(product => {
    const id = product.dataset.id;
    const name = product.querySelector('h3').textContent;
    const subtotal = cart[id] * Number(product.dataset.price);
    sum += subtotal;
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = name + ' × ' + cart[id] + ' | ' + money.format(subtotal);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'הסרה';
    remove.setAttribute('aria-label', 'הסרת ' + name);
    remove.addEventListener('click', () => { delete cart[id]; updateCart(); showCart(); });
    row.append(label, remove);
    list.append(row);
  });
  if (!list.children.length) {
    panelBody.textContent = 'סל הקניות ריק.';
    return;
  }
  const total = document.createElement('strong');
  total.textContent = 'סה״כ ' + money.format(sum);
  panelBody.append(list, total);
}

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
    cart[id] = (cart[id] || 0) + Number(product.querySelector('select').value);
    updateCart();
    notify('המוצר נוסף לעגלה');
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
document.querySelector('.cart').addEventListener('click', showCart);
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
