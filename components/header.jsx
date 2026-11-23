"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useStore } from "./store-provider";
import { asset, categoryRoute } from "@/lib/store";
import Icon from "./icon";
export default function Header() {
  const {
    categories,
    docs,
    settings,
    cart,
    setCartOpen,
    search,
    setSearch,
    loading,
  } = useStore();
  const path = usePathname(),
    router = useRouter(),
    [open, setOpen] = useState(false),
    dialog = useRef(null);
  useEffect(() => {
    setOpen(false);
    dialog.current?.close();
  }, [path]);
  const count = cart.reduce((sum, i) => sum + i.amount, 0);
  return (
    <>
      <header className="header">
        <button
          className="icon-btn menu"
          aria-label="פתיחת תפריט"
          aria-expanded={open}
          aria-controls="shop-navigation"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="menu" />
        </button>
        <Link className="logo" href="/" aria-label="סנפיר וקשקשת, עמוד הבית">
          <img
            src={asset(settings.logo)}
            alt={settings.title || "סנפיר וקשקשת"}
          />
        </Link>
        <nav
          id="shop-navigation"
          className={`navigation${open ? " open" : ""}`}
          aria-label="קטגוריות"
          aria-busy={loading}
        >
          {categories.map((c) => (
            <Link
              key={c.id}
              href={categoryRoute(c.slug)}
              aria-current={path === `/${c.slug}` ? "page" : undefined}
              onClick={() => setOpen(false)}
              data-category={c.slug}
            >
              {c.data.title}
            </Link>
          ))}
          {docs
            .filter((d) => d.kind === "pages" && d.data.show_menu)
            .map((d) => (
              <Link
                key={d.id}
                href={`/page?slug=${encodeURIComponent(d.slug)}`}
                onClick={() => setOpen(false)}
              >
                {d.data.title}
              </Link>
            ))}
        </nav>
        <div className="header-actions">
          <button
            className="icon-btn search-btn"
            aria-label="חיפוש"
            onClick={() => dialog.current.showModal()}
          >
            <Icon name="search" />
          </button>
          <button
            className="icon-btn cart-btn"
            aria-label={`סל קניות, ${count} פריטים`}
            aria-haspopup="dialog"
            aria-controls="cart-dialog"
            onClick={() => setCartOpen(true)}
          >
            <Icon name="cart" />
            <span className="cart-count" aria-live="polite">
              {count}
            </span>
          </button>
        </div>
      </header>
      <dialog id="search-dialog" ref={dialog}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            dialog.current.close();
            router.push("/#products");
          }}
        >
          <button
            type="button"
            className="close"
            aria-label="סגירה"
            onClick={() => dialog.current.close()}
          >
            ×
          </button>
          <h2>חיפוש מוצרים</h2>
          <input
            type="search"
            aria-label="חיפוש מוצרים"
            placeholder="מה תרצו לחפש?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="primary">
            הצגת תוצאות
          </button>
        </form>
      </dialog>
    </>
  );
}
