"""Generate the static category pages using the shared homepage layout."""
from pathlib import Path
import re
from html import escape

root = Path(__file__).resolve().parent.parent
home = (root / 'index.html').read_text(encoding='utf-8')
home = home.replace('href="#" aria-label="סנפיר', 'href="index.html" aria-label="סנפיר')
for key in ['sea', 'pool', 'frozen', 'smoked', 'deli']:
    home = home.replace(f'href="#categories" data-category="{key}"', f'href="{key}.html" data-category="{key}"')
    home = home.replace(f'href="#products" class="category" data-filter="{key}"', f'href="{key}.html" class="category" data-filter="{key}"')
home = home.replace('<span class="cart-count">3</span>', '<span class="cart-count" aria-live="polite">0</span>')
home = home.replace('class="icon-btn cart-btn" aria-label="סל קניות"', 'class="icon-btn cart-btn" aria-label="סל קניות" aria-haspopup="dialog" aria-controls="cart-dialog"')
drawer = '''<dialog id="cart-dialog" class="cart-drawer" aria-labelledby="cart-title">
  <div class="drawer-shell">
    <div class="drawer-grip" aria-hidden="true"><span></span></div>
    <header class="drawer-header">
      <div><p class="drawer-eyebrow">מהים. ישר אליכם.</p><h2 id="cart-title">סל הקניות שלי <span id="drawer-count">0</span></h2></div>
      <button class="drawer-close" aria-label="סגירת סל הקניות" autofocus>×</button>
    </header>
    <p class="drawer-hint">אפשר לגרור את הידית ימינה כדי לסגור</p>
    <div id="cart-items" class="drawer-items"></div>
    <footer class="drawer-footer">
      <div class="cart-total-row"><span>סכום המוצרים</span><strong class="cart-total"></strong></div>
      <p>סל להמחשה בלבד · ללא חיוב או ביצוע הזמנה</p>
      <button class="primary continue-shopping">להמשיך לבחור דגים <svg><use href="#i-chevron"/></svg></button>
    </footer>
  </div>
</dialog>'''
home = re.sub(r'<dialog id="cart-dialog".*?</dialog>', lambda _: drawer, home, flags=re.S)
(root / 'index.html').write_text(home, encoding='utf-8')

template = re.search(r'<article class="product".*?</article>', home, re.S).group()
categories = {
 'sea': ('דגי ים', 'הטעם של הים, אצלכם במטבח.', 'דגים שלמים ופילטים לארוחה הבאה שלכם.', [('דניס טרי',64.9,'denis.png','דג דניס שלם'),('לברק טרי',69.9,'sea-bass.png','דג לברק שלם'),('טונה טרי',149.9,'tuna.png','פילה טונה טרי'),('סלמון טרי',119.9,'salmon.png','פילה סלמון טרי')]),
 'pool': ('דגי בריכה', 'הדגים שכולם אוהבים.', 'מבחר דגי בריכה להכנה בדיוק בדרך שלכם.', [('אמנון טרי',39.9,'category-pool.png','שלם, פילה או פרוסות'),('קרפיון טרי',34.9,'category-pool.png','לבישול ביתי ולארוחות חג'),('בורי טרי',54.9,'category-pool.png','דג שלם להכנה בתנור'),('פורל טרי',79.9,'category-pool.png','טעם עדין לארוחה מיוחדת')]),
 'frozen': ('קפואים', 'תמיד טוב שיש במקפיא.', 'מבחר נוח לארוחה טעימה, בכל יום בשבוע.', [('פילה סלמון קפוא',89.9,'salmon.png','פילה סלמון להכנה קלה'),('פילה אמנון קפוא',34.9,'category-frozen.png','פילטים נקיים לבישול'),('פילה בקלה קפוא',44.9,'category-frozen.png','דג לבן בטעם עדין'),('סטייק טונה קפוא',99.9,'tuna.png','נתחי טונה לצריבה')]),
 'smoked': ('מעושנים', 'טעם עמוק. רגע קטן של פינוק.', 'דגים מעושנים להגשה, לאירוח ולביס המושלם.', [('סלמון מעושן',189.9,'category-smoked.png','פרוסות דקות להגשה'),('פורל מעושן',159.9,'category-smoked.png','פילה מעושן בטעם עדין'),('מקרל מעושן',89.9,'category-smoked.png','דג מעושן עשיר בטעם'),('טונה מעושנת',179.9,'category-smoked.png','פרוסות לאירוח מיוחד')]),
 'deli': ('מעדנייה', 'כל מה שמשלים את השולחן.', 'תוספות ומעדנים לצד הדגים שאתם אוהבים.', [('סלט איקרה',59.9,'category-deli.png','מעדן דגים למרכז השולחן'),('הרינג כבוש',79.9,'category-deli.png','מעדן דגים בסגנון קלאסי'),('סלט טונה',69.9,'category-deli.png','להגשה לצד לחם טרי'),('ממרח סלמון',99.9,'category-deli.png','ממרח עשיר לאירוח')]),
}
for key, (title, tagline, description, products) in categories.items():
    cards = []
    for name, price, image, subtitle in products:
        card = template.replace('סלמון טרי', escape(name)).replace('פילה סלמון טרי', escape(subtitle))
        card = card.replace('פילה '+escape(name), escape(subtitle)).replace('assets/salmon.png', 'assets/'+image).replace('119.90', f'{price:.2f}')
        card = card.replace('הוספת סלמון למועדפים', f'הוספת {escape(name)} למועדפים')
        if key in ('smoked', 'deli', 'frozen'):
            cut = {'smoked':'פרוס / מוכן להגשה','deli':'מוכן להגשה','frozen':'ארוז / קפוא'}[key]
            card = card.replace('<option>פילה</option><option>פרוסות</option><option>שלם</option>', f'<option>{cut}</option>')
        cards.append(card)
    main = f'''<main class="catalog-page">
    <section class="catalog-hero" style="--category-image:url('assets/category-{key}.png')">
      <div class="catalog-intro"><nav class="breadcrumbs" aria-label="מיקום באתר"><a href="index.html">עמוד הבית</a><span aria-hidden="true">/</span><span>{title}</span></nav>
      <p class="catalog-eyebrow">סנפיר וקשקשת · {title}</p><h1>{title}</h1><h2>{tagline}</h2><p>{description}</p></div>
      <div class="catalog-photo" role="img" aria-label="{title}"></div>
    </section>
    <section class="products catalog-products" id="products" aria-label="מוצרי {title}">
      <div class="catalog-toolbar"><div><h2>המבחר שלנו</h2><p class="catalog-count">{len(products)} מוצרים</p></div><label class="sort-label">מיון לפי<select id="product-sort"><option value="recommended">המומלצים שלנו</option><option value="price-up">מחיר: מהנמוך לגבוה</option><option value="price-down">מחיר: מהגבוה לנמוך</option><option value="name">שם המוצר</option></select></label></div>
      <p class="demo-notice">קטלוג להמחשה: המוצרים, המחירים ותמונות האווירה לדוגמה ואינם מציגים מלאי זמין להזמנה.</p>
      <div class="product-grid">{''.join(cards)}</div>
      <div class="search-empty" hidden><h3>לא נמצאו מוצרים</h3><p>אפשר לנסות לחפש בשם אחר.</p></div>
    </section>
    <section class="catalog-discover"><h2>מה עוד בא לכם?</h2><div>{''.join(f'<a href="{k}.html">{v[0]} <svg><use href="#i-chevron"/></svg></a>' for k,v in categories.items() if k != key)}</div><a class="back-home" href="index.html">חזרה לעמוד הבית</a></section>
  </main>'''
    page = re.sub(r'<main>.*?</main>', lambda _: main, home, flags=re.S)
    page = page.replace('<title>סנפיר וקשקשת | הבית של הדגים הטריים</title>', f'<title>{title} | סנפיר וקשקשת</title>')
    page = page.replace(f'data-category="{key}"', f'data-category="{key}" aria-current="page"')
    (root / f'{key}.html').write_text(page, encoding='utf-8')
