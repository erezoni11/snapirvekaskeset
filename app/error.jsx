"use client";
export default function ErrorPage({ reset }) {
  return (
    <main className="content-page">
      <h1>לא ניתן להציג את העמוד כרגע</h1>
      <p>אפשר לנסות שוב. הפריטים ששמרתם בסל נשמרים בדפדפן.</p>
      <button
        className="primary"
        style={{ padding: "12px 20px" }}
        onClick={reset}
      >
        ניסיון נוסף
      </button>
    </main>
  );
}
