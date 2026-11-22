"use client";
import Link from "next/link";
import { useStore } from "./store-provider";
export default function Footer() {
  const { settings, docs } = useStore();
  return (
    <footer className="site-footer" lang="en" dir="ltr">
      <p>
        {settings.footer_copyright ||
          "© 2026 Snapir & Kaskeset. All rights reserved."}
      </p>
      <p>
        {settings.footer_credit || (
          <>
            Developed by <span>S.Hadas</span> & <span>E.Yaakovi</span>
          </>
        )}
      </p>
      <Link
        className="accessibility-footer-link"
        href="/accessibility"
        lang="he"
        dir="rtl"
      >
        נגישות באתר
      </Link>
      <div className="managed-footer" dir="rtl">
        <p>
          {[settings.phone, settings.email, settings.address, settings.hours]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {docs
          .filter((d) => d.kind === "pages")
          .map((d) => (
            <Link key={d.id} href={`/page?slug=${encodeURIComponent(d.slug)}`}>
              {d.data.title}
            </Link>
          ))}
      </div>
    </footer>
  );
}
