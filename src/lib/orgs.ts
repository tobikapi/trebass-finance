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
    logo: '/logo.png', accent: '#d15c49', accentSoft: 'rgba(209,92,73,0.12)',
  },
  horizon: {
    // Barvy podle návrhu z iPhonu: světle modrý text na tmavě modrém poli.
    slug: 'horizon', name: 'Horizon', appTitle: 'Horizon Finance',
    logo: null, accent: '#7db5dd', accentSoft: 'rgba(37,64,138,0.55)',
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

// Vzhled světa nastavitelný adminem (organizations.look, viz sql/2026-11-07_vzhled_sveta.sql)
export interface OrgLook {
  bgUrl: string | null   // vlastní obrázek v pozadí; null = výchozí
  bgDim: number          // ztmavení 0–95 %
  bgMobile: boolean      // zobrazit i na mobilu
}
export const LOOK_DEFAULT: OrgLook = { bgUrl: null, bgDim: 82, bgMobile: false }

export function parseLook(raw: unknown): OrgLook {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const dim = Number(o.bg_dim)
  return {
    bgUrl: typeof o.bg_url === 'string' && o.bg_url ? o.bg_url : null,
    bgDim: Number.isFinite(dim) ? Math.min(95, Math.max(0, Math.round(dim))) : LOOK_DEFAULT.bgDim,
    bgMobile: o.bg_mobile === true,
  }
}

// Výchozí pozadí, když admin nic nenahrál: Třebass má fotku pódia, ostatní nic.
export function defaultBg(orgId: string | null | undefined): string | null {
  return orgId === ORG_IDS.trebass ? '/photos/photo-7.jpg' : null
}
