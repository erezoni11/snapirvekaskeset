# סנפיר וקשקשת — Next.js

הגרסה המקומית הועברה ל־Next.js App Router ול־React. פריסת Next.js ותשתית ההזמנות אושרה במפורש ב־22 בנובמבר 2026. כל פריסה דורשת אישור מפורש של שריאל לפריסה הספציפית.

## הפעלה מקומית

נדרש Node.js 24 LTS. התלויות נעולות ב־`package-lock.json`.

```powershell
npm ci
npm run dev
```

במחשב הנוכחי הוכנה גם התקנת Node ניידת בתיקיית המשתמש. להפעלה כאשר Node אינו ב־PATH:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\start-next.ps1
```

- אתר: http://localhost:3000/
- חנות עם נתוני בדיקה ומלאי: http://localhost:3000/?local-orders=1
- אדמין של אותה סביבת בדיקה: http://localhost:3000/admin?local-orders=1#orders
- יציאה ממצב בדיקה: http://localhost:3000/?local-orders=0

יש להשתמש באותו דפדפן, host ופורט בחנות ובאדמין. מצב הבדיקה נשמר בדפדפן בלבד ואינו פונה לנתונים החיים. הוא חסום בדומיין ציבורי. תשתית קבלת ההזמנות הותקנה ב־Supabase. קבלת הזמנות מחייבת מלאי זמין ואפשרויות משלוח או איסוף מפורסמות עם פרטי עסק אמיתיים.

## איפה עורכים

| חלק | מקור פעיל |
| --- | --- |
| האדר, ניווט, חיפוש ולוגו | `components/header.jsx` |
| מסגרת החנות המשותפת | `components/shop-shell.jsx` ו־`app/(shop)/layout.jsx` |
| פוטר ופרטי העסק | `components/footer.jsx` |
| סל משותף וניהול מצב | `components/cart.jsx`, `components/store-provider.jsx` |
| קרוסלה | `components/hero.jsx` |
| עמוד הבית | `components/home.jsx` |
| קטגוריות וכרטיסי מוצרים | `components/catalog.jsx`, `components/product-card.jsx`, `components/product-grid.jsx` |
| השלמת הזמנה | `components/checkout.jsx` |
| אדמין | `components/admin-view.jsx`, `lib/admin-controller.js` |
| Supabase והקשר של הדפדפן | `lib/store.js` |
| סביבת בדיקה מבודדת | `lib/local-store.js` |
| עיצוב האתר | `app/globals.css` |
| תמונות, פונטים וקבצי ספק | `public/assets/`, `public/vendor/` |
| חיבור והתאמות נגיש לי | `public/accessibility-config.js`, `public/accessibility-ui.css` |

ההאדר, הפוטר והסל מוגדרים פעם אחת ונשארים פעילים בזמן מעבר בין עמודי החנות. קטגוריות, תוכן ומחירים מגיעים מהקטלוג המפורסם ב־Supabase או מסביבת הבדיקה המקומית. מעבר עמוד או חזרה לטאב מרעננים את הקטלוג; הסל נשמר בנפרד. אין צורך ליצור מחדש קבצי HTML כדי לשנות את התפריט.

## כתובות

`/`, `/sea`, `/pool`, `/frozen`, `/smoked`, `/deli`, `/checkout`, `/admin`, `/accessibility`, `/page?slug=...`.

כתובות ישנות כגון `/smoked.html` מופנות לכתובת הנקייה, תוך שמירת query parameters. דפים וקטגוריות מותאמים מהאדמין נתמכים בנתיבי התוכן הקיימים, בלי הזרקת HTML מהדטאבייס.

## בדיקות ובנייה

```powershell
npm run build
npm run test:browser
npm run test:database
```

בדיקות הדפדפן מצפות לשרת מקומי ב־http://localhost:3000 . אפשר לשנות באמצעות `SNAPIR_BASE_URL`. הן בודקות ניווט ללא reload, זהות של ההאדר, סל משותף, הזמנות איסוף ומשלוח, אדמין ותצוגה מקדימה, מלאי, ביטול, התאוששות מאובדן תשובה, נגישות, מובייל וכתובות ישנות. קריאות API חיות חסומות בבדיקות. בדיקות SQL משתמשות ב־PostgreSQL WASM מבודד, לא בפרויקט Supabase החי.

## ארכיון ופריסה

קובצי ה־HTML וה־JavaScript הקודמים, כולל העבודה המקומית על ההזמנות והנגישות, נשמרו ב־`legacy/` לעיון. הם אינם מוגשים על ידי Next.js ואינם המקור לעריכת האתר. העיצובים המוקדמים נשמרים גם ב־`version-1` וב־`version-2`.

האתר החי הקודם: https://snapirvekaskeset.vercel.app . פריסת Next.js מוגדרת ב־`vercel.json`, עם תצורת Next.js, התקנת npm ci ובנייה באמצעות `npm run build`. Workflow ה־Pages הישן הוחלף בבדיקת build ידנית שאינה פורסת דבר. אין לבצע דחיפה ל־main או מיזוג ללא אישור פרוד מפורש.

תוסף הנגישות הרשמי NagishLi 3.0 Beta נשמר ללא שינוי, עם הרישיונות והקרדיטים. זו בטא ואינה אישור תאימות מלא לתקן. פרטי ההזמנות המבודדות והצעת Supabase: [מדריך הבדיקה המקומית](docs/checkout-local.md). תצורת ההרשאות והחשבונות: [מדריך האדמין](ADMIN-SETUP.md).
