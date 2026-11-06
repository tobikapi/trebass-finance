// Firmy (festivaly) v systému. Data každé firmy jsou v DB oddělená sloupcem
// org_id (viz sql/2026-11-06_vice_firem.sql), tady je jen to, co potřebuje
// kód: pevná id a vzhled. Nová firma = řádek v `organizations` + záznam sem.

export const ACTIVE_ORG_COOKIE = 'active_org'

export const ORG_IDS = {
  trebass: '7e1b0000-0000-4000-8000-000000000001',
  horizon: '7e1b0000-0000-4000-8000-000000000002',
} as const

export type OrgSlug = keyof typeof ORG_IDS

export interface OrgBrand {
  slug: OrgSlug
  name: string          // krátký název (přepínač, titulek)
  appTitle: string      // titulek záložky / PWA
  logo: string | null   // cesta v /public; null = textové logo (než dodají soubor)
  accent: string        // hlavní barva (aktivní položka menu, odpočet…)
  accentSoft: string    // průhledná varianta pro pozadí
}

export const ORG_BRANDS: Record<OrgSlug, OrgBrand> = {
  trebass: {
    slug: 'trebass', name: 'Třebass', appTitle: 'Třebass Finance',
    logo: '/logo.png', accent: '#e05555', accentSoft: 'rgba(224,85,85,0.12)',
  },
  horizon: {
    // Vzhled podle plakátu 2026 (modrá DnB stage) — doladí se s jejich logem.
    slug: 'horizon', name: 'Horizon', appTitle: 'Horizon Finance',
    logo: null, accent: '#6f8cff', accentSoft: 'rgba(111,140,255,0.14)',
  },
}

export interface OrgMembership {
  id: string
  slug: OrgSlug
  name: string
}

export function brandOf(orgId: string | null | undefined): OrgBrand {
  const slug = (Object.keys(ORG_IDS) as OrgSlug[]).find(s => ORG_IDS[s] === orgId)
  return ORG_BRANDS[slug ?? 'trebass']
}

export function slugOf(orgId: string): OrgSlug | null {
  return (Object.keys(ORG_IDS) as OrgSlug[]).find(s => ORG_IDS[s] === orgId) ?? null
}

// Kterou firmu otevřít: tu z cookie, pokud v ní člověk je; jinak Třebass,
// pokud v něm je; jinak první, kterou má.
export function pickActiveOrg(memberOrgIds: string[], cookieValue: string | null | undefined): string | null {
  if (cookieValue && memberOrgIds.includes(cookieValue)) return cookieValue
  if (memberOrgIds.includes(ORG_IDS.trebass)) return ORG_IDS.trebass
  return memberOrgIds[0] ?? null
}
