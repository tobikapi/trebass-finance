import type { Metadata } from "next"
import localFont from 'next/font/local'
import "./globals.css"
import AppShell from "@/components/AppShell"
import SplashScreen from "@/components/SplashScreen"
import { UserProvider } from "@/lib/user-context"
import { getInitialUser, getActiveOrgId } from "@/lib/server-user"
import { brandOf } from "@/lib/orgs"
import { ThemeProvider } from "@/lib/theme-context"
import { UndoProvider } from "@/lib/undo-context"
import { DialogProvider } from "@/lib/dialog-context"

const awakenning = localFont({
  src: '../../public/fonts/AWAKENNING.woff2',
  variable: '--font-awakenning',
  display: 'swap',
})

// Titulek záložky podle aktivní firmy (cookie hlídá proxy).
export async function generateMetadata(): Promise<Metadata> {
  const brand = brandOf(await getActiveOrgId())
  return { ...metadata, title: brand.appTitle, appleWebApp: { ...metadata.appleWebApp as object, title: brand.name } }
}

const metadata: Metadata = {
  title: "Třebass Finance",
  description: "Finanční systém pro hudební festivaly",
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
    <html lang="cs" className={awakenning.variable} data-theme="dark" data-org={brandOf(initialUser.activeOrgId).slug} suppressHydrationWarning>
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
