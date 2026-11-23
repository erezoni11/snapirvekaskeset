"use client";
import { useState } from "react";
import { useStore } from "./store-provider";
import ProductCard from "./product-card";
import Icon from "./icon";
import { matchesProductSearch, searchWords } from "@/lib/product-search";
export default function ProductGrid({ category, home = false }) {
  const { docs, categories, search, setSearch, loading, error, refresh } =
      useStore(),
    [sort, setSort] = useState("recommended"),
    [homeCategory, setHomeCategory] = useState("all");
  const words = searchWords(search);
  const products = docs.filter(
    (d) =>
      d.kind === "products" &&
      categories.some((c) => c.slug === d.data.category) &&
      (home
        ? words.length > 0 || d.data.featured
        : d.data.category === category) &&
      (!home || homeCategory === "all" || d.data.category === homeCategory) &&
      matchesProductSearch(d.data, words),
  );
  if (sort === "price-up")
    products.sort((a, b) => a.data.price_cents - b.data.price_cents);
  if (sort === "price-down")
    products.sort((a, b) => b.data.price_cents - a.data.price_cents);
  if (sort === "name")
    products.sort((a, b) => a.data.title.localeCompare(b.data.title, "he"));
  return (
    <>
      {home && (
        <nav
          className="product-category-filters"
          aria-label="סינון מוצרים לפי קטגוריה"
        >
          {[{ slug: "all", data: { title: "כל המוצרים" } }, ...categories].map(
            (c) => (
              <button
                key={c.slug}
                aria-pressed={homeCategory === c.slug}
                onClick={() => setHomeCategory(c.slug)}
              >
                {c.data.title}
              </button>
            ),
          )}
        </nav>
      )}
      {home && (
        <div className="product-search">
          <label htmlFor="home-product-search">חיפוש במבחר שלנו</label>
          <div className="product-search-field">
            <Icon name="search" />
            <input
              id="home-product-search"
              type="search"
              placeholder="למשל: סלמון, דניס או מעושן"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="ניקוי החיפוש"
                onClick={() => setSearch("")}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
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
          {words.length > 0 && (
            <p className="catalog-count search-results-count" role="status">
              {products.length} מוצרים נמצאו לחיפוש „{search.trim()}”
            </p>
          )}
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={`${p.id}:${p.version}`} product={p} />
            ))}
          </div>
          {!products.length && (
            <p className="search-empty">
              {words.length
                ? "לא נמצאו מוצרים. נסו מילה אחרת או נקו את החיפוש."
                : "אין מוצרים להצגה כרגע."}
            </p>
          )}
        </>
      )}
    </>
  );
}
