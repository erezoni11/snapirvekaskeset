"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { browserServices, readCart, asset } from "@/lib/store";
import { usePathname } from "next/navigation";
import {
  selectionPrice,
  stockQuantity,
  weightLabel,
  validSelection,
} from "@/lib/product-pricing";
const StoreContext = createContext(null);
export function StoreProvider({ children }) {
  const path = usePathname(),
    lastPath = useRef(path);
  const [services, setServices] = useState(null),
    [docs, setDocs] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [cart, setCart] = useState([]),
    [cartOpen, setCartOpen] = useState(false),
    [search, setSearch] = useState(""),
    [preview, setPreview] = useState(false);
  const previewRef = useRef(false),
    dbRef = useRef(null),
    requestRef = useRef(0);
  const refresh = useCallback(async () => {
    if (!dbRef.current) return [];
    const id = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const { data, error: problem } = await dbRef.current
        .rpc("svk_catalog")
        .abortSignal(AbortSignal.timeout(8000));
      if (problem) throw problem;
      if (!Array.isArray(data)) throw Error("Invalid catalog");
      if (!previewRef.current && id === requestRef.current) setDocs(data);
      return data;
    } catch {
      if (id === requestRef.current && !previewRef.current) {
        setDocs([]);
        setError("לא ניתן לטעון כרגע את הקטלוג. אפשר לנסות שוב.");
      }
      return null;
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    browserServices()
      .then((value) => {
        if (!active) return;
        dbRef.current = value.publicDb || value.db;
        setCart(
          readCart(value.local ? "snapir-cart-local-v1" : "snapir-cart-v1"),
        );
        setServices(value);
        refresh();
      })
      .catch(() => {
        if (active) {
          setError("לא ניתן להתחבר לחנות כרגע.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (services && lastPath.current !== path) {
      lastPath.current = path;
      refresh();
    }
  }, [path, services, refresh]);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [refresh]);
  const key = services?.local ? "snapir-cart-local-v1" : "snapir-cart-v1";
  useEffect(() => {
    if (services)
      try {
        localStorage.setItem(key, JSON.stringify(cart));
      } catch {}
  }, [cart, key, services]);
  useEffect(() => {
    const sync = (e) => {
      if (e.key === key) setCart(readCart(key));
      if (services?.local && e.key === "snapir-local-store-v1") refresh();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key, services, refresh]);
  useEffect(() => {
    const receive = (event) => {
      if (
        !new URLSearchParams(location.search).has("admin-preview") ||
        event.origin !== location.origin ||
        event.source !== parent ||
        event.data?.type !== "svk-preview" ||
        !Array.isArray(event.data.documents)
      )
        return;
      previewRef.current = true;
      setPreview(true);
      setDocs(event.data.documents);
      setLoading(false);
      setError("");
    };
    window.addEventListener("message", receive);
    if (
      new URLSearchParams(location.search).has("admin-preview") &&
      parent !== window
    )
      parent.postMessage({ type: "svk-preview-ready" }, location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);
  const add = useCallback((product, weight, cut, amount, packing = "") => {
    if (!validSelection(product.data, weight, cut)) return;
    setCart((current) => {
      const existing = current.find(
        (i) =>
          i.productId === product.id &&
          i.weightKg === weight &&
          i.cut === cut &&
          (i.packing || "") === packing,
      );
      const quantity = (existing?.amount || 0) + amount;
      if (
        quantity > 99 ||
        current
          .filter((i) => i.productId === product.id)
          .reduce(
            (n, i) => n + stockQuantity(product.data, i.weightKg, i.amount),
            0,
          ) +
          stockQuantity(product.data, weight, amount) >
          Number(product.available_kg || 0)
      )
        return current;
      if (existing)
        return current.map((i) =>
          i === existing ? { ...i, amount: quantity } : i,
        );
      return [
        ...current,
        {
          productId: product.id,
          name: product.data.title,
          weightKg: weight,
          weight: weightLabel(product.data, weight),
          cut,
          packing,
          amount,
          image: asset(product.data.image),
          unitPrice: selectionPrice(product.data, weight, cut),
        },
      ];
    });
    setCartOpen(true);
  }, []);
  const activeDocs = docs.filter((d) => d.data && d.data.active !== false);
  const settings =
    activeDocs.find((d) => d.kind === "settings" && d.slug === "main")?.data ||
    {};
  const categories = activeDocs
    .filter((d) => d.kind === "categories")
    .sort((a, b) => (a.data.position || 0) - (b.data.position || 0));
  useEffect(() => {
    for (const [name, value] of [
      ["--cyan", settings.accent],
      ["--navy", settings.navy],
    ]) {
      if (/^#[0-9a-f]{6}$/i.test(value))
        document.documentElement.style.setProperty(name, value);
      else document.documentElement.style.removeProperty(name);
    }
  }, [settings.accent, settings.navy]);
  const clearCart = useCallback(
    (ordered) =>
      setCart((current) =>
        ordered
          ? current
              .map((item) => {
                const sent = ordered
                  .filter(
                    (line) =>
                      line.product_id === item.productId &&
                      line.weight_kg === item.weightKg &&
                      line.cut === item.cut &&
                      (line.packing || "") === (item.packing || ""),
                  )
                  .reduce((n, line) => n + line.amount, 0);
                return { ...item, amount: item.amount - sent };
              })
              .filter((item) => item.amount > 0)
          : [],
      ),
    [],
  );
  return (
    <StoreContext.Provider
      value={{
        ...services,
        ready: !!services,
        docs: activeDocs,
        settings,
        categories,
        loading,
        error,
        refresh,
        cart,
        setCart,
        add,
        clearCart,
        cartOpen,
        setCartOpen,
        search,
        setSearch,
        preview,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw Error("StoreProvider is missing");
  return value;
}
