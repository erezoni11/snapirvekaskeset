const stages = [
  {
    key: "new",
    title: "חדשות · ממתינות לטיפול",
    short: "ממתינות לטיפול",
    help: "הזמנות שעדיין לא אושרו",
    icon: "inbox",
  },
  {
    key: "processing",
    title: "בטיפול",
    short: "בטיפול",
    help: "אושרו ונמצאות בהכנה",
    icon: "package",
  },
  {
    key: "ready",
    title: "מוכנות לאיסוף או למשלוח",
    short: "מוכנות",
    help: "ממתינות למסירה או לשליח",
    icon: "check",
  },
  {
    key: "shipped",
    title: "נשלחו · בדרך ללקוחות",
    short: "נשלחו",
    help: "טרם סומנו כהושלמו",
    icon: "truck",
  },
];
const paths = {
  inbox:
    '<path d="M4 4h16l2 11v5H2v-5L4 4Z"/><path d="M2 15h6l2 3h4l2-3h6M8 8h8M9 11h6"/>',
  package:
    '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v9M7.5 5.5l9 5V15"/>',
  check:
    '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7.5 12 3 3 6-6"/>',
  truck:
    '<path d="M2 5h12v12H2V5ZM14 10h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.inbox}</svg>`;
// Original vector illustrations for the four stages, drawn for this dashboard.
function stageArtwork(key) {
  const colors = {
    new: ["#ffcb99", "#ee8251", "#b94728"],
    processing: ["#b9dcff", "#679cf5", "#3863c5"],
    ready: ["#b4f1dd", "#49bfa0", "#14816e"],
    shipped: ["#dfd4ff", "#a291ef", "#6e59b9"],
  }[key];
  const artwork = {
    new: `<g transform="rotate(-9 48 44)"><rect x="26" y="12" width="37" height="50" rx="7" fill="${colors[0]}" stroke="${colors[2]}" stroke-opacity=".25"/><rect x="32" y="19" width="37" height="50" rx="7" fill="white" stroke="${colors[2]}" stroke-opacity=".3"/><path d="M41 30h17m-17 8h17m-17 8h10" stroke="${colors[1]}" stroke-width="3" stroke-linecap="round"/></g><path d="M16 46 47 30l32 16v26a9 9 0 0 1-9 9H25a9 9 0 0 1-9-9Z" fill="url(#art-new)" stroke="${colors[2]}" stroke-opacity=".3"/><path d="m16 47 31 21 32-21M17 76l22-16m39 16L56 60" fill="none" stroke="white" stroke-opacity=".65" stroke-width="2"/><circle cx="77" cy="25" r="12" fill="#fff"/><circle cx="77" cy="25" r="8" fill="${colors[1]}"/><path d="M77 21v8m-4-4h8" stroke="white" stroke-width="2" stroke-linecap="round"/>`,
    processing: `<path d="m15 31 33-18 33 18-33 19Z" fill="${colors[0]}"/><path d="M15 31v37l33 19V50Z" fill="url(#art-processing)"/><path d="M48 50v37l33-19V31Z" fill="${colors[2]}"/><path d="m31 22 33 19v17l-9 5V46L23 27Z" fill="white" fill-opacity=".65"/><path d="m23 60 12 7m-12 0 8 5" stroke="white" stroke-opacity=".65" stroke-width="2" stroke-linecap="round"/><circle cx="76" cy="69" r="17" fill="white" stroke="${colors[0]}" stroke-width="2"/><circle cx="76" cy="69" r="12" fill="#edf3ff"/><path d="M76 61v9l6 3" fill="none" stroke="${colors[2]}" stroke-width="2.5" stroke-linecap="round"/>`,
    ready: `<path d="M23 31h45l8 47a8 8 0 0 1-8 9H23a8 8 0 0 1-8-9Z" fill="url(#art-ready)"/><path d="m68 31 12 8 7 39-11 9Z" fill="${colors[2]}"/><path d="M34 38V25a12 12 0 0 1 24 0v13" fill="none" stroke="${colors[2]}" stroke-width="4" stroke-linecap="round"/><path d="M26 46h37M27 51h14" stroke="white" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/><circle cx="66" cy="66" r="18" fill="white"/><circle cx="66" cy="66" r="13" fill="${colors[2]}"/><path d="m59 66 5 5 10-11" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M79 12v10m-5-5h10" stroke="${colors[1]}" stroke-width="2" stroke-linecap="round"/>`,
    shipped: `<path d="M9 57h11m-16 8h16M8 73h9" stroke="${colors[1]}" stroke-width="2.5" stroke-linecap="round"/><path d="m22 26 39-8 12 8-39 9Z" fill="${colors[0]}"/><path d="M22 26v41l39 9V18Z" fill="url(#art-shipped)"/><path d="m61 39 17-3 14 19v21l-31 7Z" fill="${colors[2]}"/><path d="m69 43 8-1 9 13-17 3Z" fill="#e4f6ff"/><path d="m29 39 24 5m-24 3 15 3" stroke="white" stroke-opacity=".65" stroke-width="2" stroke-linecap="round"/><circle cx="38" cy="75" r="9" fill="#28384e"/><circle cx="38" cy="75" r="4" fill="${colors[0]}"/><circle cx="78" cy="78" r="9" fill="#28384e"/><circle cx="78" cy="78" r="4" fill="${colors[0]}"/><path d="M9 88h16m31 0h8" stroke="${colors[1]}" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>`,
  }[key];
  return `<svg class="stage-artwork" viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="none"><defs><linearGradient id="art-${key}" x1="18" y1="20" x2="80" y2="90" gradientUnits="userSpaceOnUse"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><ellipse cx="51" cy="88" rx="31" ry="6" fill="${colors[2]}" opacity=".1"/>${artwork}</svg>`;
}
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const timestamp = (value) => (value ? Date.parse(value) : NaN);
const formatDate = (value) =>
  Number.isFinite(timestamp(value))
    ? new Intl.DateTimeFormat("he-IL", {
        timeZone: "Asia/Jerusalem",
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "מועד לא ידוע";
const money = (value) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(
    (Number(value) || 0) / 100,
  );

export function orderTiming(order, now = Date.now()) {
  const since =
    order.status === "new" ? order.created_at : order.status_entered_at;
  const start = timestamp(since);
  const minutes = Number.isFinite(start)
    ? Math.max(0, Math.floor((now - start) / 60000))
    : null;
  const severity =
    order.status === "new" && minutes >= 60
      ? "urgent"
      : order.status === "new" && minutes >= 30
        ? "warning"
        : "normal";
  let elapsed = "מועד תחילת השלב אינו מתועד";
  if (minutes !== null) {
    if (minutes < 1) elapsed = "פחות מדקה";
    else if (minutes < 60) elapsed = minutes === 1 ? "דקה" : `${minutes} דקות`;
    else {
      const days = Math.floor(minutes / 1440),
        hours = Math.floor((minutes % 1440) / 60),
        rest = minutes % 60;
      elapsed = [
        days
          ? days === 1
            ? "יום"
            : days === 2
              ? "יומיים"
              : `${days} ימים`
          : "",
        hours
          ? hours === 1
            ? "שעה"
            : hours === 2
              ? "שעתיים"
              : `${hours} שעות`
          : "",
        rest ? (rest === 1 ? "דקה" : `${rest} דקות`) : "",
      ]
        .filter(Boolean)
        .join(" ו־");
    }
  }
  return { since, minutes, severity, elapsed };
}

export function renderOrderOverview({
  orders,
  customers,
  now = Date.now(),
  refreshedAt,
}) {
  const open = orders.filter((o) => stages.some((s) => s.key === o.status));
  const waiting = open.filter((o) => o.status === "new");
  const nextOrder = [...waiting].sort(
    (a, b) => timestamp(a.created_at) - timestamp(b.created_at),
  )[0];
  return `<section class="order-overview" aria-labelledby="order-overview-title">
    <header class="order-overview-heading">
      <div class="overview-hero-copy"><p class="order-overview-eyebrow"><span></span> מרכז ההזמנות · תמונת מצב עדכנית</p><h2 id="order-overview-title">${waiting.length ? "יש הזמנות<br>שמחכות לכם." : open.length ? "כל ההזמנות.<br>תמונה אחת ברורה." : "הכול מטופל.<br>אפשר לנשום."}</h2><p>${open.length ? `${open.length} הזמנות פתוחות · ${waiting.length} ממתינות לטיפול` : "הזמנות חדשות יופיעו כאן כשיגיעו."}</p><button type="button" class="overview-all-orders" data-go="orders">לכל ההזמנות ${icon("arrow")}</button></div>
      <div class="overview-orbit" aria-hidden="true"><i></i><i></i><i></i><span class="orbit-node"></span></div>
      ${nextOrder ? `<button type="button" class="overview-next-order" data-open-overview-order="${escape(nextOrder.id)}" aria-label="פתיחת ההזמנה הוותיקה ביותר מספר ${escape(nextOrder.number)}"><span class="next-order-label">הראשונה לטיפול ${icon("arrow")}</span><strong>#${escape(nextOrder.number)}</strong><span class="next-order-wait" data-next-order-id="${escape(nextOrder.id)}">ממתינה ${escape(orderTiming(nextOrder, now).elapsed)}</span><span class="next-order-action">בואו נטפל בה ${icon("arrow")}</span></button>` : `<div class="overview-hero-total"><strong>${open.length.toString().padStart(2, "0")}</strong><span>הזמנות פתוחות</span></div>`}
    </header>
    <div class="order-stage-metrics">${stages
      .map((stage) => {
        const count = open.filter((o) => o.status === stage.key).length;
        const share = open.length ? Math.round((count / open.length) * 100) : 0;
        return `<button type="button" class="order-stage-metric stage-${stage.key}" data-order-group="${stage.key}" ${count ? "" : "disabled"} aria-label="${escape(stage.short)}: ${count} הזמנות"><span class="stage-card-corner" aria-hidden="true">${icon("arrow")}</span>${stageArtwork(stage.key)}<span class="order-stage-count">${count.toString().padStart(2, "0")}</span><strong>${stage.short}</strong><small>${stage.help}</small><span class="stage-card-footer"><span class="stage-share-track"><i style="width:${share}%"></i></span><span>${share}% מהפתוחות</span></span></button>`;
      })
      .join("")}</div>
    ${waiting.length ? `<div class="order-attention"><span class="order-attention-icon">${icon("clock")}</span><div><strong>${waiting.length} הזמנות חדשות מחכות לטיפול</strong><p>כתום אחרי 30 דקות · אדום אחרי שעה · הזמן נספר גם מחוץ לשעות הפעילות</p></div></div>` : open.length ? `<p class="order-no-new">אין הזמנות חדשות שממתינות לאישור. ההזמנות הפעילות מופיעות בהמשך.</p>` : ""}
    <p class="order-refresh-status" role="status" data-order-refresh>עודכן ב־${escape(formatDate(refreshedAt))} · מתעדכן אוטומטית</p>
    <div class="order-stage-groups">${stages
      .map((stage) => {
        const entries = open
          .filter((o) => o.status === stage.key)
          .sort((a, b) => {
            const left = timestamp(orderTiming(a, now).since),
              right = timestamp(orderTiming(b, now).since);
            return (
              (Number.isFinite(left) ? left : Infinity) -
                (Number.isFinite(right) ? right : Infinity) ||
              (timestamp(a.created_at) || 0) - (timestamp(b.created_at) || 0)
            );
          });
        if (!entries.length) return "";
        return `<section class="order-stage-group stage-${stage.key}" aria-labelledby="overview-heading-${stage.key}"><header><span class="order-stage-icon">${icon(stage.icon)}</span><h3 id="overview-heading-${stage.key}" tabindex="-1">${stage.title}</h3><span class="order-group-count">${entries.length}</span><span class="order-group-caption">הוותיקות בראש הרשימה</span></header><div class="order-stage-list">${entries
          .map((order) => {
            const customer = customers.find((c) => c.id === order.customer_id),
              timing = orderTiming(order, now);
            const fulfillment =
              order.fulfillment ||
              (order.shipping_name?.includes("איסוף") ? "pickup" : "delivery");
            return `<article class="overview-order severity-${timing.severity}" data-overview-order="${escape(order.id)}">
          <div class="overview-order-identity"><span class="overview-customer-avatar" aria-hidden="true">${escape((customer?.name || "ל").trim().slice(0, 1))}</span><div class="overview-order-person"><div><strong class="overview-order-number">#${escape(order.number)}</strong><span class="overview-fulfillment">${fulfillment === "pickup" ? "איסוף עצמי" : "משלוח"}</span></div><h4>${escape(customer?.name || "לקוח")}</h4><p>התקבלה <time datetime="${escape(order.created_at)}">${escape(formatDate(order.created_at))}</time></p></div></div>
          <div class="overview-order-wait">${icon("clock")}<div><span>${stage.key === "new" ? "ממתינה לטיפול כבר" : "זמן בשלב הנוכחי"}</span><strong data-order-elapsed>${escape(timing.elapsed)}</strong><small data-order-priority>${priorityLabel(timing.severity)}</small></div></div>
          <div class="overview-order-total"><strong>${money(order.total_cents)}</strong><span>${order.items?.length || 0} שורות בהזמנה</span></div>
          <button type="button" class="overview-open-order" data-open-overview-order="${escape(order.id)}" aria-label="פתיחת הזמנה מספר ${escape(order.number)}">פתיחת הזמנה ${icon("arrow")}</button>
        </article>`;
          })
          .join("")}</div></section>`;
      })
      .join("")}</div>
    ${!open.length ? `<div class="order-overview-empty">${icon("check")}<strong>אפשר להתחיל את היום בראש שקט</strong><p>ההזמנות שהושלמו ובוטלו זמינות בעמוד ההזמנות.</p></div>` : ""}
  </section>`;
}

function priorityLabel(severity) {
  return severity === "urgent"
    ? "ממתינה מעל שעה · נדרש טיפול"
    : severity === "warning"
      ? "ממתינה מעל חצי שעה"
      : "";
}

export function updateOrderClocks(root, orders, now = Date.now()) {
  if (!root) return;
  const byId = new Map(orders.map((o) => [o.id, o]));
  const nextWait = root.querySelector("[data-next-order-id]");
  if (nextWait && byId.has(nextWait.dataset.nextOrderId)) {
    const text = `ממתינה ${orderTiming(byId.get(nextWait.dataset.nextOrderId), now).elapsed}`;
    if (nextWait.textContent !== text) nextWait.textContent = text;
  }
  for (const row of root.querySelectorAll("[data-overview-order]")) {
    const order = byId.get(row.dataset.overviewOrder);
    if (!order) continue;
    const timing = orderTiming(order, now);
    for (const level of ["normal", "warning", "urgent"])
      row.classList.toggle(`severity-${level}`, timing.severity === level);
    const elapsed = row.querySelector("[data-order-elapsed]"),
      priority = row.querySelector("[data-order-priority]");
    if (elapsed.textContent !== timing.elapsed)
      elapsed.textContent = timing.elapsed;
    if (priority.textContent !== priorityLabel(timing.severity))
      priority.textContent = priorityLabel(timing.severity);
  }
}
