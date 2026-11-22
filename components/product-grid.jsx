"use client";
import { useState } from "react";
import { useStore } from "./store-provider";
import ProductCard from "./product-card";
export default function ProductGrid({ category, home = false }) {
  const { docs, categories, search, loading, error, refresh } = useStore(),
    [sort, setSort] = useState("recommended");
  const products = docs.filter(
    (d) =>
      d.kind === "products" &&
      categories.some((c) => c.slug === d.data.category) &&
      (home ? d.data.featured : d.data.category === category) &&
      (!search ||
        `${d.data.title} ${d.data.description || ""}`.includes(search)),
  );
  if (sort === "price-up")
    products.sort((a, b) => a.data.price_cents - b.data.price_cents);
  if (sort === "price-down")
    products.sort((a, b) => b.data.price_cents - a.data.price_cents);
  if (sort === "name")
    products.sort((a, b) => a.data.title.localeCompare(b.data.title, "he"));
  return (
    <>
      {!home && (
        <div className="catalog-toolbar">
          <div>
            <h2>המבחר שלנו</h2>
            <p className="catalog-count">{products.length} מוצרים</p>
          </div>
          <label className="sort-label">
            מיון לפי
            <select
              id="product-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recommended">המומלצים שלנו</option>
              <option value="price-up">מחיר: מהנמוך לגבוה</option>
              <option value="price-down">מחיר: מהגבוה לנמוך</option>
              <option value="name">שם המוצר</option>
            </select>
          </label>
        </div>
      )}
      {error ? (
        <p className="storefront-status" role="alert">
          {error} <button onClick={refresh}>ניסיון נוסף</button>
        </p>
      ) : loading ? (
        <p className="search-empty" role="status">
          טוענים את המבחר…
        </p>
      ) : (
        <>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={`${p.id}:${p.version}`} product={p} />
            ))}
          </div>
          {!products.length && (
            <p className="search-empty">אין מוצרים להצגה כרגע.</p>
          )}
        </>
      )}
    </>
  );
}
