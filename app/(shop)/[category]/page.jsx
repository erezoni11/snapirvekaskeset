import Catalog from "@/components/catalog";
import { notFound } from "next/navigation";
const names = {
  sea: "דגי ים",
  pool: "דגי בריכה",
  frozen: "קפואים",
  smoked: "מעושנים",
  deli: "מעדנייה",
  raw: "נאים",
};
export function generateStaticParams() {
  return Object.keys(names).map((category) => ({ category }));
}
export async function generateMetadata({ params }) {
  const { category } = await params;
  return { title: names[category] || "קטלוג" };
}
export default async function Page({ params }) {
  const { category } = await params;
  if (!names[category]) notFound();
  return <Catalog category={category} />;
}
