import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Třebass Finance",
  description: "Finanční systém pro hudební festivaly Třebass",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body style={{ backgroundColor: '#0c0c0c', color: '#f1f5f9', margin: 0, minHeight: '100vh' }}>
        <Navigation />
        <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 32px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
