"use client";
import { useStore } from "./store-provider";
export default function AccessibilityContact() {
  const { settings } = useStore();
  return (
    <div id="accessibility-contact">
      {settings.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email) && (
        <a href={"mailto:" + settings.email}>{settings.email}</a>
      )}
      {settings.phone && /[0-9]/.test(settings.phone) && (
        <a href={"tel:" + settings.phone.replace(/[^+0-9]/g, "")}>
          {settings.phone}
        </a>
      )}
    </div>
  );
}
