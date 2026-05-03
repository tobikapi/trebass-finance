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
    <html lang="cs" className="h-full">
      <body className="min-h-full flex" style={{ backgroundColor: '#0a0a0f', color: '#e2e8f0' }}>
        <Navigation />
        <main className="flex-1 ml-64 min-h-screen p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
