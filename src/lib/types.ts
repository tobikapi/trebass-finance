export type EventStatus = 'pripravuje_se' | 'probihá' | 'dokonceno' | 'archivovano'
export type PaymentTiming = 'PŘED AKCÍ' | 'BĚHEM AKCE' | 'PO AKCI'

export interface Event {
  id: string
  name: string
  date: string | null
  date_end: string | null
  time_start: string | null
  time_end: string | null
  location: string | null
  type: string | null
  status: EventStatus
  description: string | null
  stages: string[]
  created_at: string
}

function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDateRange(date: string | null, dateEnd: string | null, timeStart?: string | null, timeEnd?: string | null): string {
  if (!date) return 'Datum neurčeno'
  const d = parseLocal(date)
  let dateStr: string
  if (!dateEnd) {
    dateStr = d.toLocaleDateString('cs-CZ')
  } else {
    const e = parseLocal(dateEnd)
    if (d.getMonth() === e.getMonth() && d.getFullYear() === e.getFullYear()) {
      dateStr = `${d.getDate()}.–${e.toLocaleDateString('cs-CZ')}`
    } else {
      dateStr = `${d.toLocaleDateString('cs-CZ')} – ${e.toLocaleDateString('cs-CZ')}`
    }
  }
  if (timeStart) {
    const t = timeStart.slice(0, 5)
    dateStr += ` ${t}`
    if (timeEnd) dateStr += `–${timeEnd.slice(0, 5)}`
  }
  return dateStr
}

export interface Expense {
  id: string
  event_id: string
  category: string
  item: string
  note: string | null
  payment_timing: PaymentTiming | null
  price: number
  deposit: number
  paid: boolean
  created_at: string
}

export interface Income {
  id: string
  event_id: string
  source: string
  amount: number
  note: string | null
  created_at: string
}

export interface LineupArtist {
  id: string
  event_id: string
  artist_name: string
  fee: number
  deposit: number
  paid: boolean
  date: string | null
  set_time: string | null
  stage: string | null
  notes: string | null
  created_at: string
}

export interface TeamContribution {
  id: string
  event_id: string
  name: string
  amount: number
  note: string | null
  created_at: string
}

export const CATEGORIES = [
  'INFRASTRUKTURA', 'LINEUP', 'SECURITY', 'VÝSTUPY', 'POMOCNÁ SÍLA',
  'TISK', 'TOPENÍ', 'LOKALITA', 'DEKORACE', 'TECHNIKA',
  'POWER', 'DOPRAVA', 'BAR', 'POJISTKA', 'REKLAMA', 'JINÉ',
]

export const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'INFRASTRUKTURA': { color: '#60a5fa', bg: '#0d1f35', border: '#1e3a5f' },
  'LINEUP':         { color: '#f4978e', bg: '#2d1515', border: '#5f1515' },
  'SECURITY':       { color: '#f87171', bg: '#2a0a0a', border: '#5f1515' },
  'VÝSTUPY':        { color: '#34d399', bg: '#052e16', border: '#0a5c2c' },
  'POMOCNÁ SÍLA':   { color: '#fbbf24', bg: '#2d2005', border: '#5c4000' },
  'TISK':           { color: '#a78bfa', bg: '#1a1035', border: '#3d2d6b' },
  'TOPENÍ':         { color: '#fb923c', bg: '#2d1500', border: '#5c3010' },
  'LOKALITA':       { color: '#4ade80', bg: '#0a2e1a', border: '#0a5020' },
  'DEKORACE':       { color: '#f472b6', bg: '#2d0520', border: '#5f1545' },
  'TECHNIKA':       { color: '#38bdf8', bg: '#0a1e2e', border: '#0a3e5c' },
  'POWER':          { color: '#fde68a', bg: '#2d2500', border: '#5c4a00' },
  'DOPRAVA':        { color: '#6ee7b7', bg: '#052a1a', border: '#0a4a30' },
  'BAR':            { color: '#f59e0b', bg: '#2d1c00', border: '#5c3800' },
  'POJISTKA':       { color: '#c084fc', bg: '#1a0830', border: '#3d1a5c' },
  'REKLAMA':        { color: '#f97316', bg: '#2d1000', border: '#5c2210' },
  'JINÉ':           { color: '#9ca3af', bg: '#1a1a1a', border: '#2d2d2d' },
}

export const INCOME_SOURCES = ['VSTUPNÉ', 'BAR', 'SPONZOR', 'DOTACE', 'JINÉ']

export const STATUS_LABELS: Record<EventStatus, string> = {
  pripravuje_se: 'Připravuje se',
  probihá: 'Probíhá',
  dokonceno: 'Dokončeno',
  archivovano: 'Archivováno',
}

export const STATUS_COLORS: Record<EventStatus, string> = {
  pripravuje_se: 'bg-blue-900/40 text-blue-300',
  probihá: 'bg-green-900/40 text-green-300',
  dokonceno: 'bg-zinc-800 text-zinc-400',
  archivovano: 'bg-red-900/20 text-red-400',
}
