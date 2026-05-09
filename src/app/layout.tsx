import type { Metadata } from "next"
import localFont from 'next/font/local'
import "./globals.css"
import AppShell from "@/components/AppShell"
import SplashScreen from "@/components/SplashScreen"
import { UserProvider } from "@/lib/user-context"
import { ThemeProvider } from "@/lib/theme-context"

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
    <html lang="cs" className={awakenning.variable} data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();` }} />
      </head>
      <body style={{ margin: 0, minHeight: '100vh' }}>
        <ThemeProvider>
          <UserProvider>
            <SplashScreen />
            <AppShell>{children}</AppShell>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
