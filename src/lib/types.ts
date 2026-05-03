export type EventStatus = 'pripravuje_se' | 'probihá' | 'dokonceno' | 'archivovano'
export type PaymentTiming = 'PŘED AKCÍ' | 'BĚHEM AKCE' | 'PO AKCI'

export interface Event {
  id: string
  name: string
  date: string | null
  location: string | null
  type: string | null
  status: EventStatus
  description: string | null
  created_at: string
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
  'INFRASTRUKTURA',
  'LINEUP',
  'SECURITY',
  'VÝSTUPY',
  'POMOCNÁ SÍLA',
  'TISK',
  'TOPENÍ',
  'LOKALITA',
  'DEKORACE',
  'TECHNIKA',
  'POWER',
  'DOPRAVA',
  'BAR',
  'POJISTKA',
  'REKLAMA',
  'JINÉ',
]

export const INCOME_SOURCES = ['VSTUPNÉ', 'BAR', 'SPONZOR', 'DOTACE', 'JINÉ']

export const STATUS_LABELS: Record<EventStatus, string> = {
  pripravuje_se: 'Připravuje se',
  probihá: 'Probíhá',
  dokonceno: 'Dokončeno',
  archivovano: 'Archivováno',
}

export const STATUS_COLORS: Record<EventStatus, string> = {
  pripravuje_se: 'bg-blue-500/20 text-blue-300',
  probihá: 'bg-green-500/20 text-green-300',
  dokonceno: 'bg-gray-500/20 text-gray-300',
  archivovano: 'bg-yellow-500/20 text-yellow-300',
}
