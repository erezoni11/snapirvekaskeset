"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStore } from "./store-provider";
import { money, asset } from "@/lib/store";
import {
  validSelection,
  stockQuantity,
  selectionPrice,
} from "@/lib/product-pricing";
const blank = {
  name: "",
  phone: "",
  email: "",
  city: "",
  street: "",
  house: "",
  apartment: "",
  notes: "",
  confirmed: false,
};
const fulfillment = (s) =>
  s?.data.method || (s?.slug === "pickup" ? "pickup" : "delivery");
const orderItems = (cart) =>
  cart.map((i) => ({
    product_id: i.productId,
    weight_kg: i.weightKg,
    amount: i.amount,
    cut: i.cut,
    ...(i.packing ? { packing: i.packing } : {}),
  }));
function quote(cart, docs, shipping) {
  const used = new Map(),
    lines = [];
  let valid = cart.length > 0,
    subtotal = 0;
  for (const item of cart) {
    const p = docs.find(
      (d) =>
        d.id === item.productId &&
        d.kind === "products" &&
        docs.some((c) => c.kind === "categories" && c.slug === d.data.category),
    );
    if (!p || !validSelection(p.data, item.weightKg, item.cut)) {
      valid = false;
      continue;
    }
    const qty = stockQuantity(p.data, item.weightKg, item.amount);
    used.set(p.id, (used.get(p.id) || 0) + qty);
    if (used.get(p.id) > Number(p.available_kg || 0)) valid = false;
    const cost = selectionPrice(p.data, item.weightKg, item.cut) * item.amount;
    subtotal += cost;
    lines.push({ item, product: p, cost });
  }
  return {
    valid,
    lines,
    subtotal,
    total: subtotal + Number(shipping?.data.price_cents || 0),
  };
}
function failure(e) {
  const text = (e?.message || "") + " " + (e?.code || "");
  if (/Price changed/.test(text))
    return "המחירים השתנו. בדקו את הסכום המעודכן ושלחו שוב.";
  if (/Insufficient stock|Product unavailable/.test(text))
    return "המלאי של אחד המוצרים השתנה. חזרו לסל ועדכנו את הבחירה.";
  if (/Too many/.test(text))
    return "נשלחו כמה הזמנות בזמן קצר. המתינו מעט לפני ניסיון נוסף.";
  if (/PGRST202|schema cache/.test(text))
    return "שליחת ההזמנות טרם הופעלה בסביבה הזו. אפשר לבדוק אותה בסביבה המקומית המבודדת.";
  return "השליחה לא הושלמה. הסל נשמר. אפשר לנסות שוב ללא יצירת הזמנה כפולה.";
}
export default function Checkout() {
  const {
      cart,
      clearCart,
      docs,
      db,
      publicDb,
      local,
      ready,
      loading,
      refresh,
    } = useStore(),
    [data, setData] = useState(blank),
    [step, setStep] = useState(1),
    [shippingId, setShippingId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(null),
    [pending, setPending] = useState(null);
  const form = useRef(null),
    errorBox = useRef(null),
    initialized = useRef(false),
    submitting = useRef(false),
    mounted = useRef(true);
  const [interactive, setInteractive] = useState(false);
  const receiptKey = local ? "snapir-local-receipt" : "snapir-receipt",
    pendingKey = receiptKey + "-pending";
  const shipping = docs
      .filter((d) => d.kind === "shipping")
      .sort((a, b) => (a.data.position || 0) - (b.data.position || 0)),
    selected = shipping.find((s) => s.id === shippingId),
    delivery = !!selected && fulfillment(selected) === "delivery",
    summary = quote(cart, docs, selected);
  useEffect(() => {
    mounted.current = true;
    setInteractive(true);
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  useEffect(() => {
    if (!ready || loading || initialized.current) return;
    initialized.current = true;
    try {
      if (!cart.length && location.hash === "#thank-you") {
        const saved = JSON.parse(sessionStorage.getItem(receiptKey) || "null");
        if (saved?.number) {
          setReceipt(saved);
          return;
        }
      }
      const saved = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
      if (
        saved &&
        JSON.stringify(saved.p_items) === JSON.stringify(orderItems(cart)) &&
        shipping.some((s) => s.id === saved.p_shipping)
      ) {
        setPending(saved);
        setData({
          ...blank,
          ...saved.p_customer,
          ...saved.p_address,
          notes: saved.p_notes,
        });
        setShippingId(saved.p_shipping);
        setStep(3);
        setError(
          "נשמר ניסיון שליחה קודם. אפשר לשלוח שוב את אותה בקשה ללא כפילות.",
        );
        return;
      }
    } catch {}
    const preferred = sessionStorage.getItem("snapir-fulfillment");
    setShippingId(
      (shipping.find((s) => fulfillment(s) === preferred) || shipping[0])?.id ||
        "",
    );
  }, [ready, loading, cart, shipping, receiptKey, pendingKey]);
  function update(name, value) {
    setData((d) => ({ ...d, [name]: value }));
    if (name !== "confirmed") {
      setPending(null);
      sessionStorage.removeItem(pendingKey);
    }
  }
  function advance() {
    if (!form.current.reportValidity()) return;
    if (!cart.length) {
      setError("הסל ריק. בחרו מוצרים בחנות כדי להמשיך להזמנה.");
      return;
    }
    if (!summary.valid) {
      setError(
        "יש בסל מוצר שאינו זמין או כמות שאינה במלאי. פתחו את הסל ועדכנו את הבחירה.",
      );
      return;
    }
    if (
      step === 1 &&
      !/^0[0-9]{8,9}$/.test(
        data.phone.replace(/[^0-9]/g, "").replace(/^972/, "0"),
      )
    ) {
      setError("יש להזין מספר טלפון ישראלי תקין.");
      return;
    }
    if (step === 2 && !selected) {
      setError(
        shipping.length
          ? "יש לבחור שיטת משלוח או איסוף."
          : "החנות עדיין לא הגדירה אפשרות משלוח או איסוף להזמנה. לא ניתן לשלוח את ההזמנה עד להגדרת שיטת מסירה.",
      );
      return;
    }
    setError("");
    setStep((v) => v + 1);
  }
  async function submit(e) {
    e.preventDefault();
    if (step !== 3) {
      advance();
      return;
    }
    if (submitting.current || !selected || !form.current.reportValidity())
      return;
    submitting.current = true;
    setBusy(true);
    setError("");
    let request = pending;
    try {
      if (!request) {
        const result = await (publicDb || db).rpc("svk_catalog");
        if (result.error) throw result.error;
        const fresh = result.data.filter((d) => d.data?.active !== false),
          shipment = fresh.find(
            (s) => s.kind === "shipping" && s.id === selected.id,
          ),
          checked = quote(cart, fresh, shipment);
        if (!shipment) throw Error("Delivery unavailable");
        if (!checked.valid) throw Error("Insufficient stock");
        if (checked.total !== summary.total) throw Error("Price changed");
        request = {
          p_customer: {
            name: data.name.trim(),
            phone: data.phone.replace(/[^0-9]/g, "").replace(/^972/, "0"),
            email: data.email.trim(),
          },
          p_items: orderItems(cart),
          p_shipping: shipment.id,
          p_address: {
            city: data.city.trim(),
            street: data.street.trim(),
            house: data.house.trim(),
            apartment: data.apartment.trim(),
          },
          p_notes: data.notes.trim(),
          p_request: crypto.randomUUID(),
          p_expected_total: checked.total,
        };
        sessionStorage.setItem(pendingKey, JSON.stringify(request));
        setPending(request);
      }
      const { data: confirmation, error: problem } = await (publicDb || db).rpc(
        "svk_checkout",
        request,
      );
      if (problem) throw problem;
      if (
        !confirmation?.order_id ||
        !Number.isSafeInteger(Number(confirmation.number)) ||
        !Number.isSafeInteger(Number(confirmation.total_cents))
      )
        throw Error("Invalid receipt");
      sessionStorage.setItem(receiptKey, JSON.stringify(confirmation));
      sessionStorage.removeItem(pendingKey);
      clearCart(request.p_items);
      refresh();
      if (mounted.current) {
        setReceipt(confirmation);
        setPending(null);
        history.replaceState(null, "", "#thank-you");
      }
    } catch (problem) {
      if (mounted.current) {
        setError(failure(problem));
        if (
          /Price changed|Insufficient stock|Product unavailable|PGRST202|Delivery unavailable/.test(
            (problem.message || "") + " " + problem.code,
          )
        ) {
          setPending(null);
          sessionStorage.removeItem(pendingKey);
          setData((d) => ({ ...d, confirmed: false }));
          refresh();
        }
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function input(name, label, options = {}) {
    return (
      <label className={options.full ? "full-field" : undefined}>
        {label}
        <input
          name={name === "name" ? "customer_name" : name}
          value={data[name]}
          onChange={(e) => update(name, e.target.value)}
          required={options.required}
          type={options.type || "text"}
          autoComplete={options.autoComplete}
          maxLength={options.maxLength || 100}
          minLength={options.minLength}
          dir={
            options.type === "tel" || options.type === "email"
              ? "ltr"
              : undefined
          }
        />
      </label>
    );
  }
  if (receipt)
    return (
      <section className="checkout-page">
        <div id="checkout-success" className="checkout-success" role="status">
          <div className="success-mark" aria-hidden="true">
            ✓
          </div>
          <p>תודה שבחרתם בנו</p>
          <h1>ההזמנה התקבלה וממתינה לאישור</h1>
          <p id="receipt-number">
            מספר ההזמנה: #{receipt.number} · סה״כ {money(receipt.total_cents)}
          </p>
          <p id="receipt-shipping">
            {receipt.fulfillment === "pickup"
              ? "בחרתם איסוף עצמי. נא להמתין לאישור שההזמנה מוכנה לפני הגעה לחנות."
              : `בחרתם ${receipt.shipping_name}. מועד המשלוח יתואם לאחר אישור החנות.`}
          </p>
          <p>החנות תיצור איתכם קשר לאישור ולתיאום. לא בוצע חיוב כספי.</p>
          <Link className="primary" href="/">
            חזרה לחנות
          </Link>
          {local && (
            <a id="receipt-admin" href="/admin?local-orders=1#orders">
              לצפייה בהזמנת הבדיקה באדמין
            </a>
          )}
        </div>
      </section>
    );
  return (
    <section className="checkout-page">
      <Link className="checkout-back" href="/">
        → חזרה לחנות
      </Link>
      <div id="checkout-flow">
        <div className="checkout-heading">
          <p>מהסל, עד אליכם</p>
          <h1>עוד רגע וההזמנה בדרך לחנות</h1>
          <p>בוחרים איך לקבל, בודקים ושולחים לאישור. ללא תשלום אונליין.</p>
        </div>
        <ol className="checkout-steps" aria-label="שלבי ההזמנה">
          {["פרטים אישיים", "משלוח או איסוף", "בדיקה ושליחה"].map((text, i) => (
            <li key={text} aria-current={step === i + 1 ? "step" : undefined}>
              <span>{i + 1}</span> {text}
            </li>
          ))}
        </ol>
        {error && (
          <p id="checkout-error" ref={errorBox} tabIndex={-1} role="alert">
            {error}
          </p>
        )}
        {!loading && !cart.length && (
          <p className="storefront-status">
            הסל ריק. בחרו מוצרים בחנות כדי להמשיך.
          </p>
        )}
        {!loading && !!cart.length && !summary.valid && !pending && (
          <p className="storefront-status" role="alert">
            יש בסל מוצר שאינו זמין או כמות שאינה במלאי. פתחו את הסל ועדכנו את
            הבחירה.
          </p>
        )}
        {!loading && step === 2 && !shipping.length && (
          <p className="storefront-status" role="alert">
            החנות עדיין לא הגדירה אפשרות משלוח או איסוף להזמנה. אפשר לחזור לסל;
            הפריטים יישמרו עד להסדרת המסירה.
          </p>
        )}
        <div className="checkout-layout">
          <form id="checkout-form" ref={form} noValidate onSubmit={submit}>
            <fieldset
              data-checkout-step="1"
              disabled={!interactive || loading || step !== 1}
              hidden={step !== 1}
            >
              <legend>נעים להכיר</legend>
              <p>נשתמש בפרטים כדי לתאם ולאשר את ההזמנה.</p>
              <div className="checkout-fields">
                {input("name", "שם מלא *", {
                  required: true,
                  autoComplete: "name",
                  minLength: 2,
                })}
                {input("phone", "טלפון *", {
                  required: true,
                  type: "tel",
                  autoComplete: "tel",
                  maxLength: 20,
                })}
                {input("email", "אימייל ליצירת קשר (לא חובה)", {
                  type: "email",
                  autoComplete: "email",
                  maxLength: 254,
                  full: true,
                })}
              </div>
            </fieldset>
            <fieldset
              data-checkout-step="2"
              disabled={!interactive || loading || step !== 2}
              hidden={step !== 2}
            >
              <legend>איך נוח לכם לקבל?</legend>
              <div id="shipping-choices" className="shipping-choices">
                {shipping.map((s) => (
                  <label className="shipping-choice" key={s.id}>
                    <input
                      type="radio"
                      name="shipping"
                      value={s.id}
                      checked={shippingId === s.id}
                      required
                      onChange={() => {
                        setShippingId(s.id);
                        setPending(null);
                        sessionStorage.removeItem(pendingKey);
                      }}
                    />
                    <span>
                      <b>
                        {s.data.title} · {money(s.data.price_cents)}
                      </b>
                      <small>{s.data.region}</small>
                      <small>{s.data.eta || "בתיאום עם החנות"}</small>
                    </span>
                  </label>
                ))}
              </div>
              {delivery && (
                <div id="delivery-address" className="checkout-fields">
                  {input("city", "יישוב *", {
                    required: true,
                    autoComplete: "address-level2",
                  })}
                  {input("street", "רחוב *", {
                    required: true,
                    autoComplete: "address-line1",
                    maxLength: 150,
                  })}
                  {input("house", "מספר בית *", {
                    required: true,
                    maxLength: 20,
                  })}
                  {input("apartment", "דירה (לא חובה)", {
                    autoComplete: "address-line2",
                    maxLength: 20,
                  })}
                </div>
              )}
              <label className="checkout-note">
                הערות לחנות (לא חובה)
                <textarea
                  name="notes"
                  rows="3"
                  maxLength={1000}
                  value={data.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </label>
            </fieldset>
            <fieldset
              data-checkout-step="3"
              disabled={!interactive || loading || step !== 3}
              hidden={step !== 3}
            >
              <legend>הכול נכון? אפשר לשלוח</legend>
              <div id="checkout-review">
                <h3>פרטי קשר</h3>
                <p>
                  {data.name} · {data.phone}
                </p>
                <h3>קבלת ההזמנה</h3>
                <p>
                  {selected?.data.title} ·{" "}
                  {delivery
                    ? [data.city, data.street, data.house, data.apartment]
                        .filter(Boolean)
                        .join(", ")
                    : selected?.data.region}
                </p>
                <h3>הערות לחנות</h3>
                <p>{data.notes || "ללא הערות"}</p>
                <h3>סה״כ לאישור, כולל משלוח / איסוף</h3>
                <p>{money(pending?.p_expected_total ?? summary.total)}</p>
              </div>
              <p className="checkout-explainer">
                ההזמנה תישלח לחנות ותמתין לאישור ולתיאום. לא מתבצע תשלום
                אונליין. הסכום מחושב לפי המשקל שבחרתם; שינוי במשקל בפועל יתואם
                איתכם.
              </p>
              <label className="checkout-consent">
                <input
                  type="checkbox"
                  name="confirmed"
                  checked={data.confirmed}
                  onChange={(e) => update("confirmed", e.target.checked)}
                  required
                />
                בדקתי את הפרטים ואני מבקש/ת לשלוח את ההזמנה לאישור החנות.
              </label>
            </fieldset>
            <div className="checkout-actions">
              {step > 1 && (
                <button
                  type="button"
                  className="checkout-secondary"
                  id="checkout-prev"
                  disabled={busy || !!pending}
                  onClick={() => {
                    setStep((v) => v - 1);
                    setError("");
                  }}
                >
                  → חזרה
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  className="primary"
                  id="checkout-next"
                  disabled={!interactive || loading || busy}
                  onClick={advance}
                >
                  להמשך ←
                </button>
              ) : (
                <button
                  type="submit"
                  className="primary"
                  id="checkout-submit"
                  disabled={busy || (!summary.valid && !pending) || !selected}
                >
                  {busy ? "שולחים את ההזמנה…" : "שליחת הזמנה לחנות ←"}
                </button>
              )}
            </div>
          </form>
          <aside
            className="checkout-summary"
            aria-labelledby="checkout-summary-title"
          >
            <h2 id="checkout-summary-title">הבחירה שלכם</h2>
            <div id="checkout-items">
              {summary.lines.map(({ item, product, cost }, i) => (
                <div className="checkout-item" key={`${product.id}:${i}`}>
                  <img src={asset(product.data.image)} alt="" />
                  <div>
                    <h3>{product.data.title}</h3>
                    <p>
                      {item.amount} × {item.weight} · {item.cut}
                    </p>
                    {item.packing && <p>{item.packing}</p>}
                    <strong>{money(cost)}</strong>
                  </div>
                </div>
              ))}
            </div>
            <dl>
              <div>
                <dt>מוצרים</dt>
                <dd>{money(summary.subtotal)}</dd>
              </div>
              <div>
                <dt>משלוח / איסוף</dt>
                <dd>
                  {selected ? money(selected.data.price_cents) : "ייבחר בהמשך"}
                </dd>
              </div>
              <div className="checkout-grand-total">
                <dt>סה״כ</dt>
                <dd id="checkout-total">
                  {money(pending?.p_expected_total ?? summary.total)}
                </dd>
              </div>
            </dl>
            <p>ללא תשלום אונליין · בכפוף לאישור החנות</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
