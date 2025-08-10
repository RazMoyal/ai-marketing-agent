import "./globals.css";
import { ReactNode } from "react";

export const metadata = { title: "Auto Marketing Agent" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-neutral-950 text-neutral-50">
        <div className="max-w-7xl mx-auto p-4">{children}</div>
      </body>
    </html>
  );
}
