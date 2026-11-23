export function searchWords(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("he-IL")
    .replace(/["'׳״“”‘’]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function matchesProductSearch(product, words) {
  if (!words.length) return true;
  const text = searchWords(
    `${product.title} ${product.description || ""}`,
  ).join(" ");
  return words.some((word) => text.includes(word));
}
