import type { Metadata } from "next"
import localFont from 'next/font/local'
import "./globals.css"
import AppShell from "@/components/AppShell"
import SplashScreen from "@/components/SplashScreen"
import { UserProvider } from "@/lib/user-context"
import { getInitialUser } from "@/lib/server-user"
import { ThemeProvider } from "@/lib/theme-context"
import { UndoProvider } from "@/lib/undo-context"
import { DialogProvider } from "@/lib/dialog-context"

const awakenning = localFont({
  src: '../../public/fonts/AWAKENNING.woff2',
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialUser = await getInitialUser()
  return (
    <html lang="cs" className={awakenning.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);try{if(sessionStorage.getItem('trebass_splash_seen')==='1')document.documentElement.setAttribute('data-splash-seen','')}catch(e){}})();` }} />
      </head>
      <body style={{ margin: 0, minHeight: '100vh' }}>
        <ThemeProvider>
          <UserProvider initial={initialUser}>
            <DialogProvider>
              <UndoProvider>
                <SplashScreen />
                <AppShell>{children}</AppShell>
              </UndoProvider>
            </DialogProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
