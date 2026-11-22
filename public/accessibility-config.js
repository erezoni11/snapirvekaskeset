// Integration layer for the unchanged official NagishLi 3.0 Beta distribution.
(() => {
  const ui = document.createElement("link");
  ui.rel = "stylesheet";
  ui.href = new URL("accessibility-ui.css", document.currentScript.src).href;
  document.head.append(ui);
  window.nagishli_config = { language: "he", color: "turquoise" };
  const statement = new URL("accessibility", document.currentScript.src).href;
  const fonts = new WeakMap();
  const nodes = () =>
    [...document.querySelectorAll("body,body *")].filter(
      (e) =>
        (e instanceof HTMLElement || e instanceof SVGElement) &&
        !e.closest("nagishli") &&
        !e.matches("script,style,noscript"),
    );
  const remember = (e) => {
    if (!fonts.has(e))
      fonts.set(e, {
        value: e.style.getPropertyValue("font-size"),
        priority: e.style.getPropertyPriority("font-size"),
      });
  };
  nodes().forEach(remember);
  let frame = 0;
  function scaleText() {
    frame = 0;
    const all = nodes();
    all.forEach((e) => {
      remember(e);
      const old = fonts.get(e);
      if (old.value) e.style.setProperty("font-size", old.value, old.priority);
      else e.style.removeProperty("font-size");
    });
    let settings = {};
    try {
      settings = JSON.parse(
        localStorage.getItem(
          "Localize-NagishLi-A11y-Plugin-Settings-v3-Beta",
        ) || "{}",
      );
    } catch {}
    const size = Number(settings["text-size"]),
      base = parseFloat(getComputedStyle(document.body).fontSize);
    if (!size || size === base) return;
    const factor = size / base,
      values = all.map((e) => parseFloat(getComputedStyle(e).fontSize));
    all.forEach((e, i) => {
      if (Number.isFinite(values[i]))
        e.style.setProperty(
          "font-size",
          `${values[i] * factor}px`,
          "important",
        );
    });
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(scaleText);
  };
  new MutationObserver((records) => {
    if (
      records.some(
        (r) =>
          r.type === "childList" &&
          !r.target.closest?.("nagishli") &&
          [...r.addedNodes].some(
            (n) =>
              n instanceof HTMLElement && !n.matches("nagishli,script,style"),
          ),
      )
    )
      schedule();
  }).observe(document.body, { subtree: true, childList: true });
  addEventListener("resize", schedule);
  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("nagishli")) schedule();
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.target.closest("nagishli")) schedule();
    },
    true,
  );
  // A skip link also makes the shop usable without opening the widget.
  const main = document.querySelector("main");
  if (main && !document.querySelector(".skip-link")) {
    main.id ||= "main-content";
    main.tabIndex = -1;
    const skip = document.createElement("a");
    skip.href = "#" + main.id;
    skip.className = "skip-link";
    skip.textContent = "דילוג לתוכן הראשי";
    document.body.prepend(skip);
  }
  const ready = new MutationObserver(() => {
    const launcher = document.querySelector("#NagishLiTrigger [role=button]"),
      widget = document.getElementById("NagishLiWidget");
    if (!launcher || !widget || !document.getElementById("NagishLiText"))
      return;
    ready.disconnect();
    launcher.setAttribute("aria-controls", widget.id);
    launcher.setAttribute("aria-label", "אפשרויות נגישות");
    launcher.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopImmediatePropagation();
          launcher.click();
        }
      },
      true,
    );
    widget.setAttribute("role", "region");
    widget.setAttribute("aria-label", "אפשרויות נגישות");
    const close = document.getElementById("NagishLiCloseBtn");
    close.setAttribute("aria-label", "סגירת אפשרויות הנגישות");
    const update = () => {
      const open = widget.classList.contains("nagishli-widget-show");
      launcher.setAttribute("aria-expanded", String(open));
      widget.inert = !open;
    };
    update();
    new MutationObserver(update).observe(widget, {
      attributes: true,
      attributeFilter: ["class"],
    });
    document
      .querySelector(".nagishli-accessibility-statement")
      ?.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          location.assign(statement);
        },
        true,
      );
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        widget.classList.contains("nagishli-widget-show") &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        close.click();
        launcher.focus();
      }
    });
    document
      .querySelectorAll('nagishli [tabindex="0"]:not([role])')
      .forEach((e) => {
        if (
          e.matches(
            ".nagishli-add,.nagishli-subtract,.nagishli-reset-settings,.nagishli-accessibility-statement",
          )
        )
          e.setAttribute("role", "button");
      });
    schedule();
  });
  ready.observe(document.body, { childList: true, subtree: true });
})();
