const paths = {
  cart: (
    <>
      <path d="M3 5h5l5 17h13l4-13H10M13 22l-2 4h16" />
      <circle cx="13" cy="29" r="1.5" />
      <circle cx="25" cy="29" r="1.5" />
    </>
  ),
  search: (
    <>
      <circle cx="13" cy="13" r="8" />
      <path d="m19 19 8 8" />
    </>
  ),
  menu: <path d="M3 7h26M3 16h26M3 25h26" />,
  heart: <path d="M16 27 5 16C-4 6 11 1 16 11c5-10 20-5 11 5z" />,
  chevron: <path d="m20 7-9 9 9 9" />,
  truck: (
    <>
      <path d="M3 8h23v20H10M26 15h7l5 7v6h-5M26 22h12M3 14h9M1 19h10M4 24h7" />
      <circle cx="16" cy="29" r="4" />
      <circle cx="30" cy="29" r="4" />
    </>
  ),
  store: (
    <path d="M5 14 10 5h20l5 9v5c-3 3-6 3-9 0-3 3-9 3-12 0-3 3-6 3-9 0zM8 21v11h24V21M16 32V23h8v9M13 5l-3 9M20 5v9M27 5l3 9" />
  ),
};
export default function Icon({ name }) {
  return (
    <svg
      viewBox={["truck", "store"].includes(name) ? "0 0 40 36" : "0 0 32 32"}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
