"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useStore } from "./store-provider";
import { asset, categoryRoute, categoryNames } from "@/lib/store";
import ProductGrid from "./product-grid";
function Category({ category }) {
  const params = useSearchParams(),
    slug = params.get("category") || category,
    { categories, loading } = useStore(),
    doc = categories.find((c) => c.slug === slug),
    title =
      doc?.data.title ||
      (loading ? categoryNames[category] : "קטגוריה לא זמינה");
  return (
    <div className="catalog-page">
      <section className="catalog-hero">
        <div className="catalog-intro">
          <nav className="breadcrumbs" aria-label="מיקום באתר">
            <Link href="/">עמוד הבית</Link>
            <span aria-hidden="true">/</span>
            <span>{title}</span>
          </nav>
          <p className="catalog-eyebrow">סנפיר וקשקשת · {title}</p>
          <h1>{title}</h1>
          <h2>{doc?.data.subtitle}</h2>
          <p>{doc?.data.description}</p>
        </div>
        <div
          className="catalog-photo"
          role="img"
          aria-label={title}
          style={{
            backgroundImage: `url(${JSON.stringify(asset(doc?.data.image, category === "raw" ? "/assets/catalog/sashimi.webp" : `/assets/category-${category}.png`))})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      </section>
      <section className="products catalog-products" id="products">
        <ProductGrid category={slug} />
      </section>
      <section className="catalog-discover">
        <h2>מה עוד בא לכם?</h2>
        <div>
          {categories
            .filter((c) => c.slug !== slug)
            .map((c) => (
              <Link key={c.id} href={categoryRoute(c.slug)}>
                {c.data.title} ←
              </Link>
            ))}
        </div>
        <Link className="back-home" href="/">
          חזרה לעמוד הבית
        </Link>
      </section>
    </div>
  );
}
export default function Catalog(props) {
  return (
    <Suspense fallback={<p className="search-empty">טוענים את העמוד…</p>}>
      <Category {...props} />
    </Suspense>
  );
}
