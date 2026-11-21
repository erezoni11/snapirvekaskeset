// Configuration for the unchanged official NagishLi 2.3 distribution.
// Resolve against this script so local preview, Vercel and GitHub Pages all work.
(() => {
  const base = document.currentScript.src;
  window.nl_lang = 'he';
  window.nl_pos = 'bl';
  window.nl_color = 'turquoise';
  window.nl_compact = '1';
  window.nl_accordion = '1';
  window.nl_dir = new URL('vendor/nagishli/nl-files/', base).href;
  window.nl_link = new URL('accessibility.html', base).href;

  // Preserve the site's responsive type hierarchy when the legacy widget changes
  // text size. Keep this compatibility layer separate from the original plugin.
  const originalFonts = new WeakMap();
  const contentNodes = () => [...document.querySelectorAll('body, body *')].filter(
    node => node instanceof HTMLElement && !node.closest('nagishli') && !node.matches('script,style,noscript')
  );
  const remember = node => {
    if (!originalFonts.has(node)) originalFonts.set(node, {
      value: node.style.getPropertyValue('font-size'),
      priority: node.style.getPropertyPriority('font-size')
    });
  };
  contentNodes().forEach(remember);
  let fontFrame = 0;
  let sized = false;
  const resizeText = () => {
    fontFrame = 0;
    const value = Number(document.body.getAttribute('nl-text'));
    const active = Number.isFinite(value) && value > 0;
    if (!active && !sized) return;
    const nodes = contentNodes();
    for (const node of nodes) {
      remember(node);
      const original = originalFonts.get(node);
      if (original.value) node.style.setProperty('font-size', original.value, original.priority);
      else node.style.removeProperty('font-size');
    }
    if (active) {
      const factor = value / parseFloat(getComputedStyle(document.body).fontSize);
      const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node, index) => {
        if (Number.isFinite(sizes[index])) node.style.setProperty('font-size', `${sizes[index] * factor}px`, 'important');
      });
    }
    sized = active;
  };
  const scheduleFonts = () => { if (!fontFrame) fontFrame = requestAnimationFrame(resizeText); };
  new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' && record.target === document.body ||
      record.type === 'childList' && !record.target.closest?.('nagishli') && [...record.addedNodes].some(node => node instanceof HTMLElement && !node.matches('nagishli,style,script')))) scheduleFonts();
  }).observe(document.body, { attributes: true, attributeFilter: ['nl-text'], childList: true, subtree: true });
  window.addEventListener('resize', scheduleFonts);

  // Add launcher semantics and Escape handling without changing vendor files.
  const ready = new MutationObserver(() => {
    const launcher = document.getElementById('NagishLiBarStrip');
    const menu = document.getElementById('NagishLiMenus');
    if (!launcher || !menu) return;
    ready.disconnect();
    launcher.setAttribute('role', 'button');
    launcher.setAttribute('aria-controls', menu.id);
    document.getElementById('NagishLiStatement')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(window.nl_link);
    }, { capture: true });
    const update = () => {
      const open = menu.style.display !== 'none';
      launcher.setAttribute('aria-expanded', String(open));
      launcher.setAttribute('aria-label', open ? 'סגירת תפריט הנגישות' : 'פתיחת תפריט הנגישות');
    };
    update();
    new MutationObserver(update).observe(menu, { attributes: true, attributeFilter: ['style'] });
    launcher.addEventListener('keydown', event => {
      if (event.key === ' ') { event.preventDefault(); launcher.click(); }
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || menu.style.display === 'none' || document.querySelector('dialog[open]')) return;
      const restoreFocus = menu.contains(document.activeElement);
      event.preventDefault();
      launcher.click();
      if (restoreFocus) launcher.focus();
    });
  });
  ready.observe(document.body, { childList: true, subtree: true });
})();
