"use client";
import { useEffect } from "react";
const pending = new Map();
function load(src, integrity) {
  if (!pending.has(src))
    pending.set(
      src,
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.charset = "utf-8";
        if (integrity) {
          script.integrity = integrity;
          script.crossOrigin = "anonymous";
        }
        script.onload = resolve;
        script.onerror = () => reject(Error("Failed to load " + src));
        document.body.append(script);
      }),
    );
  return pending.get(src);
}
export default function Accessibility() {
  useEffect(() => {
    let active = true;
    load(
      "/vendor/jquery/jquery-3.7.1.min.js",
      "sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=",
    )
      .then(() => active && load("/accessibility-config.js"))
      .then(
        () =>
          active &&
          load("/vendor/nagishli-v3/nagishli_v3_beta/nagishli_beta.js?v=3.0b"),
      )
      .catch((error) => console.error(error));
    return () => {
      active = false;
    };
  }, []);
  return null;
}
