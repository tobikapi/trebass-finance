import type { Metadata, Viewport } from "next"
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

// iPhone: viewport-fit=cover, aby šlo ve standalone PWA (průhledný status bar)
// odsadit obsah od výřezu přes env(safe-area-inset-*). Zoom necháváme povolený
// (přístupnost) — nechtěnému přibližování brání 16px písmo v polích.
export function generateViewport(): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: [
      { media: '(prefers-color-scheme: dark)', color: '#111111' },
      { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    ],
    colorScheme: 'dark light',
  }
}

// Titulek záložky podle aktivní firmy (cookie hlídá proxy).
export async function generateMetadata(): Promise<Metadata> {
  const brand = brandOf(await getActiveOrgId())
  return { ...metadata, title: brand.appTitle, appleWebApp: { ...metadata.appleWebApp as object, title: brand.name } }
}

const metadata: Metadata = {
  title: "Třebass Finance",
  description: "Finanční systém pro hudební festivaly",
  manifest: "/manifest.json",
  icons: { apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }] },
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
    <html lang="cs" className={awakenning.variable} data-theme="dark" data-org={brandOf(initialUser.activeOrgId).slug}
      style={{ ['--accent' as string]: brandOf(initialUser.activeOrgId).accent, ['--accent-soft' as string]: brandOf(initialUser.activeOrgId).accentSoft }}
      suppressHydrationWarning>
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
