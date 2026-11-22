"use client";
import { useState } from "react";
import { useStore } from "./store-provider";
import { asset } from "@/lib/store";
import Icon from "./icon";
export default function ProductCard({ product }) {
  const { add, cart, preview } = useStore(),
    p = product.data;
  const [weight, setWeight] = useState(p.weights?.[0] || 1),
    [cut, setCut] = useState(p.cuts?.[0] || "שלם"),
    [amount, setAmount] = useState(1),
    [favorite, setFavorite] = useState(false);
  const reserved = cart
    .filter((i) => i.productId === product.id)
    .reduce((n, i) => n + Number(i.weightKg || 0) * i.amount, 0);
  const unavailable =
    reserved + amount * weight > Number(product.available_kg || 0);
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
          {(p.price_cents / 100).toFixed(2)} <small>₪ לק״ג</small>
        </div>
        <div className="options">
          <label>
            משקל:
            <select
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
            >
              {(p.weights || [1]).map((w) => (
                <option value={w} key={w}>
                  {w < 1 ? `${w * 1000} גרם` : `${w} ק״ג`}
                </option>
              ))}
            </select>
          </label>
          <label>
            חיתוך:
            <select value={cut} onChange={(e) => setCut(e.target.value)}>
              {(p.cuts || ["שלם"]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
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
            disabled={preview || unavailable}
            onClick={() => add(product, weight, cut, amount)}
          >
            {preview ? (
              "תצוגה מקדימה"
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
