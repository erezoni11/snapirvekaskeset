"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStore } from "./store-provider";
import "./admin-theme.css";
export default function AdminView() {
  const { db, local, ready } = useStore(),
    root = useRef(null);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let active = true,
      dispose;
    document.body.classList.add("admin-body");
    import("@/lib/admin-controller").then(({ mountAdmin }) => {
      if (active) {
        dispose = mountAdmin({ db, local });
        setInteractive(true);
      }
    });
    return () => {
      active = false;
      dispose?.();
      document.body.classList.remove("admin-body");
    };
  }, [db, local, ready]);
  return (
    <div ref={root} className="admin-body" id="main-content" tabIndex={-1}>
      <section id="login-view" className="login-layout">
        <div className="login-story">
          <Link href="/">
            <img src="/assets/logo.png" alt="סנפיר וקשקשת" />
          </Link>
          <p className="eyebrow">{"הכול מתחיל מאחורי הקלעים"}</p>
          <h1>
            {"הים שלכם."}
            <br />
            {"השליטה בידיים שלכם."}
          </h1>
          <p>{"התוכן, המוצרים וההזמנות — במקום אחד."}</p>
          <div className="login-photo"></div>
          <span className="login-credit" lang="en" dir="ltr">
            {"Developed by S.Hadas & E.Yaakovi"}
          </span>
        </div>

        <div className="login-panel">
          <div className="login-box">
            <p className="eyebrow">{"סביבת הניהול"}</p>
            <h2>{"טוב שחזרתם."}</h2>
            <p>{"הכניסה מיועדת למנהלים ולעובדים שהוזמנו לחנות."}</p>

            <form id="login-form">
              <label>
                {"שם משתמש או כתובת אימייל"}
                <input
                  disabled={!interactive}
                  type="text"
                  name="username"
                  autoComplete="username"
                  dir="ltr"
                  required
                  placeholder="sariel / erez"
                />
              </label>
              <label>
                {"סיסמה"}
                <input
                  disabled={!interactive}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  dir="ltr"
                  required
                />
              </label>
              <button
                disabled={!interactive}
                className="admin-primary"
                type="submit"
              >
                {"כניסה לפאנל "}
                <span aria-hidden="true">{"←"}</span>
              </button>
            </form>

            <p
              id="login-status"
              className="form-status"
              role="status"
              aria-live="polite"
            ></p>

            <Link className="demo-link" href="/admin?demo=1">
              {"הצצה לפאנל עם נתוני הדגמה"}
            </Link>
            <Link className="login-back" href="/">
              {"חזרה לאתר החנות"}
            </Link>
          </div>
        </div>
      </section>

      <div id="admin-app" className="admin-layout" hidden>
        <aside className="admin-sidebar">
          <Link className="admin-brand" href="/">
            <img src="/assets/logo.png" alt="סנפיר וקשקשת" />
            <span>{"סביבת ניהול"}</span>
          </Link>
          <nav id="admin-nav" aria-label="ניווט ניהול"></nav>
          <div className="sidebar-foot">
            <span className="connection-dot"></span>
            <span id="connection-label">{"מחובר ל־Supabase"}</span>
          </div>
        </aside>

        <div className="admin-workspace">
          <header className="admin-topbar">
            <span className="topbar-brand">
              {"סנפיר וקשקשת "}
              <span>{"/"}</span>
              {" ניהול החנות"}
            </span>
            <div>
              <Link
                href={local ? "/?local-orders=1" : "/"}
                target="_blank"
                rel="noopener"
              >
                {"צפייה באתר ↗"}
              </Link>
              <span id="staff-label"></span>
              <button id="change-password">{"שינוי סיסמה"}</button>
              <button id="logout">{"יציאה"}</button>
            </div>
          </header>

          <div id="demo-banner" className="demo-banner" hidden>
            {
              "מצב הדגמה · נתונים לדוגמה בלבד. השינויים זמניים ואינם נשמרים בדטאבייס או באתר החי. "
            }
            <Link href="/admin">{"מעבר לכניסה אמיתית"}</Link>
          </div>

          <main className="admin-main">
            <div className="admin-page-heading">
              <div className="admin-heading-title">
                <span
                  id="section-art"
                  className="admin-section-art"
                  aria-hidden="true"
                ></span>
                <div className="admin-heading-copy">
                  <p id="section-eyebrow" className="eyebrow">
                    {"מבט על החנות"}
                  </p>
                  <h1 id="section-title">{"סקירה כללית"}</h1>
                  <p id="section-description"></p>
                </div>
              </div>
              <div id="section-actions" className="section-actions"></div>
            </div>
            <p
              id="admin-notice"
              className="admin-notice"
              role="status"
              aria-live="polite"
              hidden
            ></p>
            <div id="admin-content"></div>
          </main>

          <footer className="admin-footer" lang="en" dir="ltr">
            {
              "© 2026 Snapir & Kaskeset. All rights reserved. Developed by S.Hadas & E.Yaakovi."
            }
          </footer>
        </div>
      </div>

      <dialog
        id="editor-dialog"
        className="admin-dialog"
        aria-labelledby="editor-title"
      >
        <form id="editor-form">
          <header className="editor-heading">
            <span
              id="editor-art"
              className="editor-art"
              aria-hidden="true"
            ></span>
            <div className="editor-heading-copy">
              <p className="eyebrow" id="editor-context">
                {"עריכת טיוטה"}
              </p>
              <h2 id="editor-title"></h2>
            </div>
            <button
              type="button"
              className="dialog-close"
              data-close
              aria-label="סגירת עורך"
            >
              {"×"}
            </button>
          </header>
          <div id="editor-fields" className="editor-fields"></div>
          <p id="editor-error" className="form-status" role="alert"></p>
          <footer className="editor-footer">
            <button type="button" data-close className="admin-secondary">
              {"ביטול"}
            </button>
            <button type="submit" className="admin-primary" id="save-editor">
              {"שמירת טיוטה"}
            </button>
          </footer>
        </form>
      </dialog>

      <dialog
        id="admin-confirm-dialog"
        className="admin-confirm-dialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <form method="dialog" id="admin-confirm-form">
          <div
            className="confirm-art"
            id="confirm-art"
            aria-hidden="true"
          ></div>
          <p className="eyebrow">{"לפני שממשיכים"}</p>
          <h2 id="confirm-title"></h2>
          <p id="confirm-message"></p>
          <footer>
            <button
              type="button"
              className="admin-secondary"
              id="confirm-cancel"
              autoFocus
            >
              {"חזרה"}
            </button>
            <button type="submit" className="admin-primary" id="confirm-accept">
              {"אישור"}
            </button>
          </footer>
        </form>
      </dialog>

      <dialog
        id="preview-dialog"
        className="preview-dialog"
        aria-labelledby="preview-title"
      >
        <header>
          <div>
            <h2 id="preview-title">{"תצוגה מקדימה"}</h2>
            <p>{"כך השינויים ייראו באתר. הטיוטה עדיין לא פורסמה."}</p>
          </div>
          <button className="admin-secondary" id="close-preview">
            {"סגירה"}
          </button>
        </header>
        <iframe id="preview-frame" title="תצוגה מקדימה של האתר"></iframe>
      </dialog>
    </div>
  );
}
