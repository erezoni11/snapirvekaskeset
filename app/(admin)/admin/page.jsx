import AdminView from "@/components/admin-view";
export const metadata = {
  title: "ניהול האתר",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminView />;
}
