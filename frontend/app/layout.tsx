import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Thesis Management System" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">AI-Assisted University Thesis Management System</header>
        <main>{children}</main>
      </body>
    </html>
  );
}