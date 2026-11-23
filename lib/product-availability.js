import { stockQuantity, validSelection } from "./product-pricing";

export function availableProduct(docs, id) {
  return docs.find(
    (d) =>
      d.id === id &&
      d.kind === "products" &&
      d.data.active !== false &&
      docs.some(
        (c) =>
          c.kind === "categories" &&
          c.slug === d.data.category &&
          c.data.active !== false,
      ),
  );
}

// Compare integer thousandths, matching inventory precision without float drift.
export function fitsStock(product, cart, weight, amount = 0) {
  if (!product) return false;
  const stock = Number(product.available_kg);
  const requested = cart
    .filter((i) => i.productId === product.id)
    .reduce(
      (n, i) =>
        n +
        Math.round(stockQuantity(product.data, i.weightKg, i.amount) * 1000),
      Math.round(stockQuantity(product.data, weight, amount) * 1000),
    );
  return (
    Number.isFinite(stock) &&
    stock >= 0 &&
    requested <= Math.round(stock * 1000)
  );
}

export function cartItemAvailable(docs, cart, item) {
  const product = availableProduct(docs, item.productId);
  return (
    !!product &&
    validSelection(product.data, item.weightKg, item.cut) &&
    fitsStock(product, cart, item.weightKg)
  );
}
