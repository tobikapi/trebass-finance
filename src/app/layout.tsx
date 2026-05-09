import type { Metadata } from "next"
import localFont from 'next/font/local'
import "./globals.css"
import AppShell from "@/components/AppShell"
import SplashScreen from "@/components/SplashScreen"
import { UserProvider } from "@/lib/user-context"

const awakenning = localFont({
  src: '../../public/fonts/AWAKENNING.ttf',
  variable: '--font-awakenning',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Třebass Finance",
  description: "Finanční systém pro hudební festivaly Třebass",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Třebass",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" className={awakenning.variable}>
      <body style={{ backgroundColor: '#0c0c0c', color: '#f1f5f9', margin: 0, minHeight: '100vh' }}>
        <UserProvider>
          <SplashScreen />
          <AppShell>{children}</AppShell>
        </UserProvider>
      </body>
    </html>
  )
}
