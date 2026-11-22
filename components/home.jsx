"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import Hero from "./hero";
import ProductGrid from "./product-grid";
import { useStore } from "./store-provider";
import { asset, categoryRoute } from "@/lib/store";
import Icon from "./icon";
export default function Home() {
  const { settings, categories } = useStore(),
    grid = useRef(null),
    [delivery, setDelivery] = useState(null);
  function choose(mode) {
    setDelivery(mode);
    sessionStorage.setItem("snapir-fulfillment", mode);
  }
  return (
    <>
      <Hero />
      <section className="service-strip" aria-label="אפשרויות קבלת הזמנה">
        {["delivery", "pickup"].map((mode) => (
          <button
            key={mode}
            className="service"
            data-delivery={mode}
            aria-pressed={delivery === mode}
            onClick={() => choose(mode)}
          >
            <Icon name={mode === "delivery" ? "truck" : "store"} />
            <span>
              <strong>
                {settings[
                  mode === "delivery" ? "delivery_title" : "pickup_title"
                ] || (mode === "delivery" ? "משלוח עד הבית" : "איסוף עצמי")}
              </strong>
              <small>
                {settings[
                  mode === "delivery" ? "delivery_subtitle" : "pickup_subtitle"
                ] || (mode === "delivery" ? "בקירור ולכל הארץ" : "מהחנות שלנו")}
              </small>
            </span>
          </button>
        ))}
      </section>
      <section className="categories" id="categories">
        <h2 className="heading waves">
          <span>{settings.categories_heading || "מה בא לכם היום?"}</span>
        </h2>
        <div className="category-wrap">
          <div
            className="category-grid"
            ref={grid}
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, categories.length)},minmax(0,1fr))`,
            }}
          >
            {categories.map((c) => (
              <Link
                href={categoryRoute(c.slug)}
                className="category"
                key={c.id}
                data-live="true"
              >
                <img src={asset(c.data.image)} alt="" />
                <span>
                  {c.data.title} <Icon name="chevron" />
                </span>
              </Link>
            ))}
          </div>
          <button
            className="category-arrow cat-prev"
            aria-label="קטגוריות קודמות"
            onClick={() =>
              grid.current.scrollBy({ left: -200, behavior: "smooth" })
            }
          >
            <Icon name="chevron" />
          </button>
          <button
            className="category-arrow cat-next"
            aria-label="קטגוריות נוספות"
            onClick={() =>
              grid.current.scrollBy({ left: 200, behavior: "smooth" })
            }
          >
            <Icon name="chevron" />
          </button>
        </div>
      </section>
      <section className="products" id="products">
        <h2 className="heading lines">
          <span>{settings.products_heading || "הבחירה של הלקוחות שלנו"}</span>
        </h2>
        <ProductGrid home />
      </section>
    </>
  );
}
