export const money = (cents) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(
    (Number(cents) || 0) / 100,
  );
export const categoryNames = {
  sea: "דגי ים",
  pool: "דגי בריכה",
  frozen: "קפואים",
  smoked: "מעושנים",
  deli: "מעדנייה",
  raw: "נאים",
};
export const categoryRoute = (slug) =>
  Object.hasOwn(categoryNames, slug)
    ? `/${slug}`
    : `/sea?category=${encodeURIComponent(slug)}`;
export function asset(value, fallback = "/assets/logo.png") {
  if (!value) return fallback;
  if (/^\/?assets\//.test(value)) return "/" + value.replace(/^\//, "");
  if (value.startsWith("/")) return value.startsWith("//") ? fallback : value;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
  } catch {
    return fallback;
  }
}
let services;
export function browserServices() {
  if (typeof window === "undefined")
    throw Error("Browser services are client-only");
  services ||= (async () => {
    const { createLocalStore } = await import("./local-store");
    const local = createLocalStore();
    if (local) {
      await local.ready;
      return { db: local.client, local };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const url = "https://nhiibjhssbmsqajrslvr.supabase.co",
      key = "sb_publishable_hqarcz4Mo4CuoD4B95xXDg_80gjAW9S";
    return {
      db: createClient(url, key),
      // Public shopping must not depend on a stored staff session or its refresh lock.
      publicDb: createClient(url, key, { accessToken: async () => null }),
      local: null,
    };
  })();
  return services;
}
export function readCart(key) {
  try {
    const items = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(items)
      ? items
          .filter(
            (i) =>
              i &&
              typeof i.name === "string" &&
              typeof i.cut === "string" &&
              Number.isInteger(i.amount) &&
              i.amount > 0 &&
              i.amount <= 99 &&
              Number.isInteger(i.unitPrice) &&
              i.unitPrice >= 0,
          )
          .map((i) => ({ ...i, image: asset(i.image) }))
      : [];
  } catch {
    return [];
  }
}
