const drawings = {
  products:
    '<path d="m25 31 25-12 25 12-25 13Z" fill="#d4e6ff"/><path d="M25 31v29l25 14V44Z" fill="#8bb4f3"/><path d="M50 44v30l25-14V31Z" fill="#507cc8"/><path d="m37 25 25 13v12l-8 4V41L30 29Z" fill="#f1f6ff"/><path d="m33 52 9 5m-9 1 6 3" stroke="white" stroke-width="2" stroke-linecap="round"/>',
  categories:
    '<rect x="24" y="23" width="23" height="22" rx="6" fill="#7cacdf"/><rect x="53" y="23" width="23" height="22" rx="6" fill="#b8d6f5"/><rect x="24" y="51" width="23" height="22" rx="6" fill="#c5e3df"/><rect x="53" y="51" width="23" height="22" rx="6" fill="#5eaaa3"/><path d="M31 34h9m-4-4v8m24 24 4 4 7-8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>',
  inventory:
    '<path d="M24 36h52v36H24Z" fill="#94c9bc"/><path d="m24 36 10-13h32l10 13Z" fill="#c7e9df"/><path d="M24 41h52M44 48h13" stroke="#3d8c7a" stroke-width="3"/><path d="M44 23v13h13V23" fill="#e9f8f2"/><rect x="19" y="60" width="24" height="20" rx="5" fill="#f4cf8e"/><path d="M26 68h10m-10 5h6" stroke="#a97c30" stroke-width="2" stroke-linecap="round"/>',
  orders:
    '<rect x="27" y="16" width="44" height="62" rx="7" fill="#ffd4ae"/><path d="M36 29h25m-25 9h25m-25 9h16m-16 9h12" stroke="#be7d4f" stroke-width="3" stroke-linecap="round"/><circle cx="69" cy="67" r="16" fill="#e99a67"/><path d="m62 67 5 5 9-11" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  customers:
    '<circle cx="44" cy="33" r="13" fill="#a7c8ef"/><path d="M19 72c0-16 11-25 25-25s25 9 25 25Z" fill="#6493ce"/><circle cx="72" cy="48" r="9" fill="#d3e4fa"/><path d="M65 62c10-5 19 3 19 13H66Z" fill="#9dbde4"/><path d="M35 59h17" stroke="#d9e9fc" stroke-width="2" stroke-linecap="round"/>',
  shipping:
    '<path d="M18 29h38v35H18Z" fill="#b4a6e3"/><path d="m56 40 15-2 14 17v16H56Z" fill="#7f6abd"/><path d="m63 46 7-1 8 10-15 2Z" fill="#e9f4ff"/><circle cx="30" cy="68" r="9" fill="#3d435b"/><circle cx="73" cy="71" r="9" fill="#3d435b"/><circle cx="30" cy="68" r="4" fill="#e7ddff"/><circle cx="73" cy="71" r="4" fill="#e7ddff"/><path d="M10 43h17m-20 9h14" stroke="#a797d9" stroke-width="3" stroke-linecap="round"/>',
  settings:
    '<rect x="19" y="21" width="63" height="53" rx="8" fill="#a3d7ce"/><path d="M20 35h61" stroke="#4b998e" stroke-width="2"/><circle cx="28" cy="28" r="2" fill="#4b998e"/><circle cx="35" cy="28" r="2" fill="#4b998e"/><rect x="28" y="43" width="23" height="22" rx="4" fill="#e5f7ef"/><path d="M59 46h14m-14 8h14m-14 8h9" stroke="#438d83" stroke-width="3" stroke-linecap="round"/>',
  pages:
    '<path d="M29 15h30l16 16v48H29Z" fill="#bbd8f4"/><path d="M59 15v17h16" fill="#7ca8d7"/><path d="M39 42h25m-25 9h25m-25 9h18" stroke="#658ebf" stroke-width="3" stroke-linecap="round"/>',
  staff:
    '<path d="m49 15 27 10v21c0 18-27 34-27 34S22 64 22 46V25Z" fill="#b6d3ed"/><path d="m49 23 19 7v16c0 11-19 25-19 25S30 57 30 46V30Z" fill="#638fc0"/><path d="m38 46 8 8 16-19" stroke="#eef7ff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  audit:
    '<rect x="23" y="18" width="48" height="61" rx="7" fill="#d4c5ef"/><path d="M34 32h25m-25 10h25m-25 10h12" stroke="#9476bf" stroke-width="3" stroke-linecap="round"/><circle cx="68" cy="65" r="17" fill="#9b80c7"/><path d="M68 55v11l7 4" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>',
};

export function adminArtwork(key) {
  return `<svg class="admin-artwork" viewBox="0 0 100 100" fill="none" stroke="none" aria-hidden="true"><ellipse cx="50" cy="85" rx="33" ry="6" fill="#263f5b" opacity=".08"/><path d="m10 41 40-23 40 23v34L50 96 10 75Z" fill="#dce8f3" opacity=".2"/>${drawings[key] || drawings.settings}<path d="M83 17v8m-4-4h8" stroke="#7ebbb1" stroke-width="2" stroke-linecap="round"/></svg>`;
}
