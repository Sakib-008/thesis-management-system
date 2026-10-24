import "./globals.css";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import Header from "@/components/ui/Header";

export const metadata = { title: "Thesis Management System" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}