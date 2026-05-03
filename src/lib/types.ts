export type EventStatus = 'pripravuje_se' | 'probihá' | 'dokonceno' | 'archivovano'
export type PaymentTiming = 'PŘED AKCÍ' | 'BĚHEM AKCE' | 'PO AKCI'

export interface Event {
  id: string
  name: string
  date: string | null
  date_end: string | null
  location: string | null
  type: string | null
  status: EventStatus
  description: string | null
  created_at: string
}

export function formatDateRange(date: string | null, dateEnd: string | null): string {
  if (!date) return 'Datum neurčeno'
  const d = new Date(date)
  if (!dateEnd) return d.toLocaleDateString('cs-CZ')
  const e = new Date(dateEnd)
  if (d.getMonth() === e.getMonth() && d.getFullYear() === e.getFullYear()) {
    return `${d.getDate()}.–${e.toLocaleDateString('cs-CZ')}`
  }
  return `${d.toLocaleDateString('cs-CZ')} – ${e.toLocaleDateString('cs-CZ')}`
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
  set_time: string | null
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
