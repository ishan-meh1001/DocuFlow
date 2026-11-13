import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuFlow | Documentation intelligence",
  description: "Keep product documentation aligned with the codebase.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
