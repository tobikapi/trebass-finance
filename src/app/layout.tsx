import type { Metadata } from "next"
import "./globals.css"
import AppShell from "@/components/AppShell"
import SplashScreen from "@/components/SplashScreen"

export const metadata: Metadata = {
  title: "Třebass Finance",
  description: "Finanční systém pro hudební festivaly Třebass",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body style={{ backgroundColor: '#0c0c0c', color: '#f1f5f9', margin: 0, minHeight: '100vh' }}>
        <SplashScreen />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
