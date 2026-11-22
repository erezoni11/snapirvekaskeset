"use client";
import { useState, useEffect, useRef } from "react";
import { useStore } from "./store-provider";
import Icon from "./icon";
import { asset } from "@/lib/store";
const defaults = [
  {
    title: "מהים.\nישר אליכם.",
    text: "דגים טריים, איכות ללא פשרות",
    photo: "/assets/hero-fresh-v2.png",
  },
  {
    title: "טריות בכל ביס.",
    text: "סלמון טרי, בדיוק כמו שאתם אוהבים",
    photo: "/assets/hero-salmon-v2.png",
  },
  {
    title: "איכות שמרגישים.",
    text: "פילטים מובחרים לארוחה הבאה שלכם",
    photo: "/assets/hero-fillets-v2.png",
  },
];
const originals = [
  "hero-desktop.png",
  "hero-mobile.png",
  "denis.png",
  "salmon.png",
];
export default function Hero() {
  const { settings } = useStore(),
    [slide, setSlide] = useState(0),
    [mobile, setMobile] = useState(false),
    touch = useRef(null);
  useEffect(() => {
    const media = matchMedia("(max-width:700px)"),
      update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const prefix = slide ? `slide${slide + 1}` : "hero",
    fallback = defaults[slide];
  const requested =
    (!slide && mobile
      ? settings.hero_mobile || settings.hero_image
      : settings[`${prefix}_image`]) || fallback.photo;
  const photo = originals.some(
    (name) => requested === `assets/${name}` || requested === `/assets/${name}`,
  )
    ? fallback.photo
    : asset(requested, fallback.photo);
  const next = (delta) => setSlide((v) => (v + delta + 3) % 3);
  return (
    <section
      className="hero"
      role="region"
      aria-roledescription="קרוסלה"
      aria-label="דגים טריים עד הבית"
      data-slide={slide + 1}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          next(1);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          next(-1);
        }
      }}
    >
      <div
        className="hero-photo"
        role="img"
        aria-label={
          ["דגים טריים על קרח", "פילה סלמון טרי", "פילטים טריים של דג לבן"][
            slide
          ]
        }
        style={{ backgroundImage: `url(${JSON.stringify(photo)})` }}
        onTouchStart={(e) => {
          touch.current =
            e.touches.length === 1
              ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
              : null;
        }}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const x = e.changedTouches[0].clientX - touch.current.x,
            y = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.5)
            next(x > 0 ? -1 : 1);
        }}
        onTouchCancel={() => (touch.current = null)}
      />
      <div className="hero-copy">
        <h1
          aria-live="polite"
          aria-atomic="true"
          style={{ whiteSpace: "pre-line" }}
        >
          {(settings[`${prefix}_title`] ?? fallback.title).replace(
            /<br>/g,
            "\n",
          )}
        </h1>
        <p>{settings[`${prefix}_subtitle`] ?? fallback.text}</p>
        <a href="#products" className="primary hero-cta">
          {settings.hero_cta || "להזמנה עכשיו"} <Icon name="chevron" />
        </a>
      </div>
      <button
        className="hero-arrow previous"
        aria-label="תמונה קודמת"
        onClick={() => next(-1)}
      >
        <Icon name="chevron" />
      </button>
      <button
        className="hero-arrow next"
        aria-label="תמונה הבאה"
        onClick={() => next(1)}
      >
        <Icon name="chevron" />
      </button>
      <div className="dots" aria-label="בחירת באנר">
        {defaults.map((_, i) => (
          <button
            key={i}
            className={i === slide ? "active" : ""}
            aria-label={`באנר ${i + 1}`}
            aria-pressed={i === slide}
            onClick={() => setSlide(i)}
          />
        ))}
      </div>
    </section>
  );
}
