"use client";
import { useState } from "react";
import { useStore } from "./store-provider";
import { asset } from "@/lib/store";
import Icon from "./icon";
import {
  isUnit,
  priceLabel,
  weightLabel,
  rate,
  selectionPrice,
  stockQuantity,
  validSelection,
} from "@/lib/product-pricing";
import { money } from "@/lib/store";
export default function ProductCard({ product }) {
  const { add, cart, preview } = useStore(),
    p = product.data;
  const [weight, setWeight] = useState(p.weights?.[0] || 1),
    [cut, setCut] = useState(p.cuts?.[0] || "שלם"),
    [amount, setAmount] = useState(1),
    [packing, setPacking] = useState(""),
    [favorite, setFavorite] = useState(false);
  const reserved = cart
    .filter((i) => i.productId === product.id)
    .reduce((n, i) => n + stockQuantity(p, i.weightKg, i.amount), 0);
  const unavailable =
    reserved + stockQuantity(p, weight, amount) >
    Number(product.available_kg || 0);
  const valid = validSelection(p, weight, cut);
  return (
    <article
      className="product"
      data-product-id={product.id}
      data-live="true"
      data-name={p.title}
      data-price={p.price_cents / 100}
    >
      <div className="product-image">
        <img src={asset(p.image)} alt={p.title} loading="lazy" />
        <button
          className="favorite"
          aria-label={`הוספת ${p.title} למועדפים`}
          aria-pressed={favorite}
          onClick={() => setFavorite((v) => !v)}
        >
          <Icon name="heart" />
        </button>
      </div>
      <div className="product-info">
        <h3>{p.title}</h3>
        <p>{p.description}</p>
        <div className="price">
          {p.price_confirmed === false ? (
            "מחיר בבירור"
          ) : (
            <>
              {money(rate(p, weight, cut))} <small>{priceLabel(p)}</small>
            </>
          )}
        </div>
        <div className="options">
          {isUnit(p) && (
            <label>
              יחידת מכירה:
              <output className="product-sale-unit">{weightLabel(p, 1)}</output>
            </label>
          )}
          {!isUnit(p) && (
            <label>
              {p.weight_label || "משקל ליחידה:"}
              <select
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
              >
                {(p.weights || [1]).map((w) => (
                  <option value={w} key={w}>
                    {weightLabel(p, w)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {p.cuts?.length > 1 && (
            <label>
              {p.option_label || "חיתוך:"}
              <select value={cut} onChange={(e) => setCut(e.target.value)}>
                {(p.cuts || ["שלם"]).map((c) => (
                  <option
                    key={c}
                    value={c}
                    disabled={!validSelection(p, weight, c)}
                  >
                    {c}
                    {p.cut_surcharges?.[c]
                      ? ` (+${money(p.cut_surcharges[c])} ${priceLabel(p)})`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {p.price_confirmed !== false && (
          <p className="selection-total">
            {isUnit(p) ? "ליחידה" : `ליחידה במשקל ${weightLabel(p, weight)}`}:{" "}
            <strong>{money(selectionPrice(p, weight, cut))}</strong>
          </p>
        )}
        <details className="product-notes">
          <summary>הערה לחיתוך ולאריזה</summary>
          {p.packaging_options?.length > 0 && (
            <p>{p.packaging_options.join(" · ")}</p>
          )}
          <label>
            בקשה לחנות
            <input
              aria-label={`הערה עבור ${p.title}`}
              value={packing}
              maxLength={300}
              onChange={(e) => setPacking(e.target.value)}
              placeholder="למשל: לארוז בבודדים"
            />
          </label>
        </details>
        <div className="buy">
          <div className="quantity" aria-label="כמות">
            <button
              className="minus"
              aria-label="הפחתת כמות"
              onClick={() => setAmount((v) => Math.max(1, v - 1))}
            >
              −
            </button>
            <output>{amount}</output>
            <button
              className="plus"
              aria-label="הגדלת כמות"
              onClick={() => setAmount((v) => Math.min(99, v + 1))}
            >
              +
            </button>
          </div>
          <button
            className="add-cart primary"
            disabled={preview || unavailable || !valid}
            onClick={() => add(product, weight, cut, amount, packing.trim())}
          >
            {preview ? (
              "תצוגה מקדימה"
            ) : p.price_confirmed === false ? (
              "לבירור מול החנות"
            ) : !valid ? (
              "יש לבחור אפשרות זמינה"
            ) : unavailable ? (
              "אזל מהמלאי"
            ) : (
              <>
                <Icon name="cart" />
                להוספה לסל
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
