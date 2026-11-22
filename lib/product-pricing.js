// Prices are always integer agorot. Inventory quantities use the product's sale unit.
export const isUnit = (p) => p.sale_unit === "unit";
export const unitLabel = (p) => (isUnit(p) ? "יח׳" : "ק״ג");
export const priceLabel = (p) => (isUnit(p) ? "ליחידה" : "לק״ג");
export function weightLabel(p, weight) {
  if (isUnit(p)) return p.unit_label || "יחידה";
  return (
    p.weight_labels?.[weight] ||
    (weight < 1 ? `${Math.round(weight * 1000)} גרם` : `${weight} ק״ג`)
  );
}
export function rate(p, weight, cut) {
  return (
    Number(p.price_cents) +
    Number(p.cut_surcharges?.[cut] || 0) +
    Number(p.weight_surcharges?.[weight] || 0)
  );
}
export function selectionPrice(p, weight, cut) {
  return Math.round(rate(p, weight, cut) * (isUnit(p) ? 1 : weight));
}
export function stockQuantity(p, weight, amount = 1) {
  return Math.round(amount * (isUnit(p) ? 1 : weight) * 1000) / 1000;
}
export function validSelection(p, weight, cut) {
  return (
    p.price_confirmed !== false &&
    p.price_cents > 0 &&
    (p.weights || []).includes(weight) &&
    (p.cuts || []).includes(cut) &&
    (!p.allowed_combinations ||
      p.allowed_combinations.some((c) => c.weight === weight && c.cut === cut))
  );
}
