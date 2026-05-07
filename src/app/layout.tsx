import type { Metadata } from "next"
import "./globals.css"
import AppShell from "@/components/AppShell"
import SplashScreen from "@/components/SplashScreen"
import { UserProvider } from "@/lib/user-context"

export const metadata: Metadata = {
  title: "Třebass Finance",
  description: "Finanční systém pro hudební festivaly Třebass",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body style={{ backgroundColor: '#0c0c0c', color: '#f1f5f9', margin: 0, minHeight: '100vh' }}>
        <UserProvider>
          <SplashScreen />
          <AppShell>{children}</AppShell>
        </UserProvider>
      </body>
    </html>
  )
}
