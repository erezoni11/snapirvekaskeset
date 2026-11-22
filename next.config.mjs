const nextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      ...[
        "sea",
        "pool",
        "frozen",
        "smoked",
        "deli",
        "checkout",
        "admin",
        "page",
        "accessibility",
      ].map((name) => ({
        source: `/${name}.html`,
        destination: `/${name}`,
        permanent: true,
      })),
    ];
  },
};
export default nextConfig;
