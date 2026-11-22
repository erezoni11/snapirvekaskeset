"use client";
import Header from "./header";
import Footer from "./footer";
import Cart from "./cart";
import { useStore } from "./store-provider";
export default function ShopShell({ children }) {
  const { local, preview } = useStore();
  return (
    <>
      {local && (
        <div className="local-preview-banner">
          סביבת בדיקה מקומית · נתוני דוגמה בלבד · לא נשלח לחנות החיה{" "}
          <a href="/admin?local-orders=1#orders">ניהול הזמנות הבדיקה</a>
          <a href="/?local-orders=0">יציאה ממצב בדיקה</a>
        </div>
      )}
      {preview && (
        <div className="store-preview-banner">
          תצוגה מקדימה של טיוטה · השינויים עדיין לא פורסמו
        </div>
      )}
      <div className="page">
        <Header />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </div>
      <Cart />
    </>
  );
}
