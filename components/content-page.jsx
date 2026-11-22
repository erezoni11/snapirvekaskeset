"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStore } from "./store-provider";
import { asset } from "@/lib/store";
function Content() {
  const params = useSearchParams(),
    { docs, loading } = useStore(),
    page = docs.find(
      (d) => d.kind === "pages" && d.slug === params.get("slug"),
    );
  return (
    <section className="content-page">
      <Link href="/">עמוד הבית /</Link>
      <h1>
        {page?.data.title || (loading ? "טוענים את העמוד…" : "העמוד אינו זמין")}
      </h1>
      <h2>{page?.data.subtitle}</h2>
      {page?.data.image && (
        <img src={asset(page.data.image)} alt="" style={{ maxWidth: "100%" }} />
      )}
      <div className="text-block" style={{ whiteSpace: "pre-wrap" }}>
        {page?.data.body}
      </div>
    </section>
  );
}
export default function ContentPage() {
  return (
    <Suspense fallback={<p>טוענים…</p>}>
      <Content />
    </Suspense>
  );
}
