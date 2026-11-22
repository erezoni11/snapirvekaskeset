"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "./store-provider";
import { money } from "@/lib/store";
import Icon from "./icon";
export default function Cart() {
  const { cart, setCart, cartOpen, setCartOpen, docs } = useStore(),
    dialog = useRef(null),
    start = useRef(null),
    path = usePathname();
  useEffect(() => {
    setCartOpen(false);
  }, [path, setCartOpen]);
  useEffect(() => {
    const el = dialog.current;
    let timer;
    if (cartOpen) {
      el.showModal();
      document.body.classList.add("cart-is-open");
      requestAnimationFrame(() => el.classList.add("is-open"));
    } else {
      el.classList.remove("is-open");
      timer = setTimeout(
        () => {
          el.close();
          document.body.classList.remove("cart-is-open");
        },
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280,
      );
    }
    return () => clearTimeout(timer);
  }, [cartOpen]);
  useEffect(() => () => document.body.classList.remove("cart-is-open"), []);
  const close = () => setCartOpen(false),
    count = cart.reduce((n, i) => n + i.amount, 0);
  const dragEnd = (e) => {
    if (start.current === null) return;
    const distance = e.clientX - start.current;
    start.current = null;
    dialog.current.style.removeProperty("--drag-x");
    dialog.current.classList.remove("is-dragging");
    if (
      e.type !== "pointercancel" &&
      distance > Math.min(100, dialog.current.clientWidth * 0.23)
    )
      close();
  };
  function change(index, delta) {
    setCart((items) =>
      items.map((i, n) =>
        n === index
          ? { ...i, amount: Math.max(1, Math.min(99, i.amount + delta)) }
          : i,
      ),
    );
  }
  return (
    <dialog
      id="cart-dialog"
      className="cart-drawer"
      ref={dialog}
      aria-labelledby="cart-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right) close();
        }
      }}
    >
      <div className="drawer-shell">
        <div
          className="drawer-grip"
          aria-hidden="true"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            start.current = e.clientX;
            e.currentTarget.setPointerCapture(e.pointerId);
            dialog.current.classList.add("is-dragging");
          }}
          onPointerMove={(e) => {
            if (start.current !== null)
              dialog.current.style.setProperty(
                "--drag-x",
                `${Math.max(0, e.clientX - start.current)}px`,
              );
          }}
          onPointerUp={dragEnd}
          onPointerCancel={dragEnd}
        >
          <span />
        </div>
        <header className="drawer-header">
          <div>
            <p className="drawer-eyebrow">מהים. ישר אליכם.</p>
            <h2 id="cart-title">
              סל הקניות שלי <span id="drawer-count">{count}</span>
            </h2>
          </div>
          <button
            className="drawer-close"
            aria-label="סגירת סל הקניות"
            autoFocus
            onClick={close}
          >
            ×
          </button>
        </header>
        <p className="drawer-hint">אפשר לגרור את הידית ימינה כדי לסגור</p>
        <div id="cart-items" className="drawer-items">
          {!cart.length ? (
            <div className="cart-empty">
              <div className="empty-cart-icon">
                <Icon name="cart" />
              </div>
              <h3>הסל מחכה לבחירה שלכם</h3>
              <p>בחרו מה אוהבים, ונשמור אותו כאן.</p>
              <button className="empty-browse" onClick={close}>
                לבחירת מוצרים ←
              </button>
            </div>
          ) : (
            cart.map((item, index) => {
              const stock = Number(
                  docs.find((d) => d.id === item.productId)?.available_kg || 0,
                ),
                reserved = cart
                  .filter((i) => i.productId === item.productId)
                  .reduce((n, i) => n + Number(i.weightKg || 0) * i.amount, 0);
              return (
                <article
                  className="cart-entry"
                  key={`${item.productId || item.name}:${item.weight}:${item.cut}`}
                >
                  <img src={item.image} alt={item.name} />
                  <div className="cart-entry-details">
                    <h3>{item.name}</h3>
                    <p>
                      {item.weight} · {item.cut}
                    </p>
                    <strong>{money(item.unitPrice * item.amount)}</strong>
                    <div className="cart-entry-controls">
                      <div className="cart-quantity">
                        <button
                          disabled={item.amount <= 1}
                          aria-label={`הפחתת כמות של ${item.name}`}
                          onClick={() => change(index, -1)}
                        >
                          −
                        </button>
                        <span aria-label="כמות">{item.amount}</span>
                        <button
                          disabled={
                            item.amount >= 99 ||
                            reserved + Number(item.weightKg || 0) > stock
                          }
                          aria-label={`הגדלת כמות של ${item.name}`}
                          onClick={() => change(index, 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="remove-item"
                        aria-label={`הסרת ${item.name} מהסל`}
                        onClick={() =>
                          setCart((items) =>
                            items.filter((_, n) => n !== index),
                          )
                        }
                      >
                        הסרה
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <footer className="drawer-footer">
          <div className="cart-total-row">
            <span>סכום המוצרים</span>
            <strong className="cart-total">
              {money(cart.reduce((n, i) => n + i.unitPrice * i.amount, 0))}
            </strong>
          </div>
          <p>ההזמנה תישלח לאישור החנות · ללא תשלום אונליין</p>
          {!!cart.length && (
            <Link
              className="primary checkout-link"
              href="/checkout"
              onClick={close}
            >
              להמשך ההזמנה ←
            </Link>
          )}
          <button className="primary continue-shopping" onClick={close}>
            להמשיך לבחור דגים <Icon name="chevron" />
          </button>
        </footer>
      </div>
    </dialog>
  );
}
