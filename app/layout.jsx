import "./globals.css";
import { StoreProvider } from "@/components/store-provider";
import Accessibility from "@/components/accessibility";
export const metadata = {
  title: {
    default: "סנפיר וקשקשת | הבית של הדגים הטריים",
    template: "%s | סנפיר וקשקשת",
  },
  description: "דגים טריים, משלוח עד הבית או איסוף עצמי.",
  icons: { icon: "/assets/logo.png" },
};
export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <a className="skip-link" href="#main-content">
          דילוג לתוכן הראשי
        </a>
        <StoreProvider>{children}</StoreProvider>
        <Accessibility />
      </body>
    </html>
  );
}
