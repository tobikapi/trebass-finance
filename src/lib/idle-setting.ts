// Po kolika minutách nečinnosti se automaticky odhlásit. Volí si každý sám,
// ukládá se v daném zařízení (telefon může mít kratší čas než počítač).
export const IDLE_OPTIONS = [5, 10, 20, 30, 60] as const
export type IdleMinutes = typeof IDLE_OPTIONS[number]
export const IDLE_DEFAULT: IdleMinutes = 10

const KEY = 'idle_logout_min'
export const LAST_ACTIVITY_KEY = 'last_activity_at'
export const IDLE_CHANGE_EVENT = 'idle-setting-change'

export function getIdleMinutes(): IdleMinutes {
  if (typeof window === 'undefined') return IDLE_DEFAULT
  const v = Number(window.localStorage.getItem(KEY))
  return (IDLE_OPTIONS as readonly number[]).includes(v) ? (v as IdleMinutes) : IDLE_DEFAULT
}

export function setIdleMinutes(min: IdleMinutes) {
  window.localStorage.setItem(KEY, String(min))
  window.dispatchEvent(new Event(IDLE_CHANGE_EVENT))
}

export function idleLabel(min: number) {
  return min === 60 ? '1 hodina' : `${min} min`
}
