'use strict';

const storageKey = 'snapir-cart';
const products = new Map(
  Array.from(document.querySelectorAll('.product[data-price]'), (card) => [
    card.id,
    {
      name: card.querySelector('h3').textContent,
      price: Number(card.dataset.price),
      image: card.querySelector('img').getAttribute('src'),
      weight: card.querySelector('select').value,
      button: card.querySelector('.add'),
    },
  ]),
);
const dialog = document.querySelector('#cart');
const floatingButton = document.querySelector('.cart-float');
const headingButton = document.querySelector('.cart-close');
const list = document.querySelector('.cart-items');
const rowTemplate = document.querySelector('#cart-row');
const status = document.querySelector('.cart-status');
const currency = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return new Map(Object.entries(saved).filter(([id, quantity]) =>
      products.has(id) && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 99,
    ));
  } catch {
    return new Map();
  }
}

const cart = readCart();

function setQuantity(id, quantity, message) {
  if (quantity > 99) {
    status.textContent = 'אפשר להוסיף עד 99 יחידות מכל מוצר';
    return;
  }
  if (quantity > 0) {
    cart.set(id, quantity);
  } else {
    cart.delete(id);
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(cart)));
  } catch {
    // The cart still works for this visit if local storage is unavailable.
  }
  renderCart();
  status.textContent = message;
}

function renderCart() {
  const focused = list.contains(document.activeElement) ? document.activeElement : null;
  const focusedId = focused?.closest('li')?.dataset.product;
  const focusedAction = focused?.dataset.action;
  let nextFocus;
  let count = 0;
  let total = 0;
  const rows = document.createDocumentFragment();

  for (const [id, quantity] of cart) {
    const product = products.get(id);
    const subtotal = product.price * quantity;
    count += quantity;
    total += subtotal;

    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.product = id;
    row.querySelector('img').src = product.image;
    row.querySelector('strong').textContent = product.name;
    row.querySelector('.cart-weight').textContent = product.weight;
    row.querySelector('.cart-quantity').textContent = quantity;
    row.querySelector('bdi').textContent = currency.format(subtotal);
    row.querySelector('[data-action="decrease"]').setAttribute('aria-label', `הפחתת כמות של ${product.name}`);
    row.querySelector('[data-action="increase"]').setAttribute('aria-label', `הגדלת כמות של ${product.name}`);
    row.querySelector('[data-action="remove"]').setAttribute('aria-label', `הסרת ${product.name} מהסל`);
    if (id === focusedId) nextFocus = row.querySelector(`[data-action="${focusedAction}"]`);
    rows.append(row);
  }

  list.replaceChildren(rows);
  floatingButton.hidden = count === 0;
  floatingButton.querySelector('.cart-count').textContent = count;
  floatingButton.querySelector('.cart-float-total').textContent = currency.format(total);
  dialog.querySelector('.cart-empty').hidden = count > 0;
  dialog.querySelector('.cart-summary').hidden = count === 0;
  dialog.querySelector('.cart-total').textContent = currency.format(total);
  if (focused) (nextFocus || list.querySelector('button') || headingButton).focus();
}

for (const [id, product] of products) {
  product.button.addEventListener('click', () => {
    const wasEmpty = cart.size === 0;
    const quantity = (cart.get(id) || 0) + 1;
    setQuantity(id, quantity, `${product.name} נוסף לסל. כמות בסל: ${quantity}`);
    if (wasEmpty) dialog.showModal();
  });
}

for (const button of document.querySelectorAll('[data-open-cart]')) {
  button.addEventListener('click', () => dialog.showModal());
}

dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const { left, right, top, bottom } = dialog.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
    dialog.close();
  }
});

list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.closest('li').dataset.product;
  const current = cart.get(id);
  const changes = { decrease: current - 1, increase: current + 1, remove: 0 };
  const quantity = changes[button.dataset.action];
  const { name } = products.get(id);
  setQuantity(id, quantity, quantity ? `${name}, כמות בסל: ${quantity}` : `${name} הוסר מהסל`);
});

renderCart();
