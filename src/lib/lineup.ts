import type { LineupArtist } from '@/lib/types'

// Částky jsou v `lineup_fees` (databáze je vydá jen s oprávněním „Honoráře
// v Lineupu"). Načítají se přibalené k lineupu; bez oprávnění přijde null.
export const LINEUP_SELECT = '*, lineup_fees(fee, deposit, travel_cost, paid)'

type FeesRow = { fee: number; deposit: number; travel_cost: number; paid: boolean }
type LineupRow = Omit<LineupArtist, 'fee' | 'deposit' | 'travel_cost' | 'paid'> & {
  lineup_fees?: FeesRow | FeesRow[] | null
}

export function toArtist(row: LineupRow): LineupArtist {
  const { lineup_fees, ...rest } = row
  const fees = Array.isArray(lineup_fees) ? lineup_fees[0] : lineup_fees
  return {
    ...rest,
    fee: fees?.fee ?? 0,
    deposit: fees?.deposit ?? 0,
    travel_cost: fees?.travel_cost ?? 0,
    paid: fees?.paid ?? false,
  }
}
