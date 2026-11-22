import Link from "next/link";
export default function NotFound() {
  return (
    <main className="content-page">
      <h1>העמוד לא נמצא</h1>
      <Link href="/">חזרה לחנות</Link>
    </main>
  );
}
