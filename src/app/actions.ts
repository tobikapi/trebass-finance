import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { todayPrague } from '@/lib/ledger'
import { EVENT_PERMISSION_KEYS, hasPermission, type PermissionKey, type Permissions } from '@/lib/permissions'

async function requireAuth() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Neautorizovaný přístup')
  return supabase
}

// Skutečná oprávnění podle role v DB — bez ohledu na „Zobrazit jako", ta
// existuje jen v currentPermissions() níž. Použij tuhle variantu všude, kde
// jde o bezpečnostní rozhodnutí, u kterého by falšovaný náhled neměl mít
// slovo (typicky: kdo smí udělit administrátorská práva).
async function realPermissions(supabase: Awaited<ReturnType<typeof requireAuth>>): Promise<Permissions | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.from('profiles').select('roles(permissions)').eq('id', user.id).single()
  if (error || !data) return null
  const rel = (data as Record<string, unknown>).roles
  const role = (Array.isArray(rel) ? rel[0] : rel) as { permissions?: Permissions } | null | undefined
  return role?.permissions ?? null
}

// Načte oprávnění přihlášeného uživatele. Vrací null, když uživatel nemá
// přiřazenou roli nebo role systém ještě není v DB — hasPermission() pak
// povolí vše. Viz komentář u hasPermission v permissions.ts: zamykat lidi ven
// kvůli nedoběhlé migraci by bylo horší než je nechat pracovat.
//
// Admin si může v appce zapnout „Zobrazit jako [role]" — vynucuje se to
// i tady na serveru (ne jen skrytí v UI), aby šlo reálně ověřit co která
// role smí, ne jen co vidí. Cookie respektujeme jen když je skutečná role
// admin — jinak by šlo obejít oprávnění tím, že si někdo nastaví cookie ručně.
async function currentPermissions(supabase: Awaited<ReturnType<typeof requireAuth>>): Promise<Permissions | null> {
  const real = await realPermissions(supabase)

  if (real?.admin === true) {
    const cookieStore = await cookies()
    const viewAsRoleId = cookieStore.get('trebass_view_as')?.value
    if (viewAsRoleId) {
      const { data: viewRole } = await supabase.from('roles').select('permissions').eq('id', viewAsRoleId).single()
      if (viewRole) return viewRole.permissions ?? null
    }
  }

  return real
}

// Vrátí chybovou hlášku, když uživatel na akci nemá právo, jinak null.
async function denyUnless(supabase: Awaited<ReturnType<typeof requireAuth>>, key: PermissionKey): Promise<string | null> {
  const perms = await currentPermissions(supabase)
  return hasPermission(perms, key) ? null : 'Na tuhle akci nemáš oprávnění.'
}

// Oprávnění uvnitř konkrétní akce: role NEBO výjimka v event_access.permissions
// (viz has_event_perm v sql/2026-10-12b_vyjimky_v_akci.sql). Databáze to
// vynucuje i sama — tady jde o srozumitelnou hlášku místo tichého „nic se
// neuložilo". Bez event_id (úkol mimo akci) platí jen role. Při náhledu
// „Zobrazit jako" se výjimky ignorují a platí jen zobrazovaná role.
async function denyUnlessEvent(
  supabase: Awaited<ReturnType<typeof requireAuth>>, eventId: string | null | undefined, key: PermissionKey
): Promise<string | null> {
  if (!eventId) return denyUnless(supabase, key)
  const cookieStore = await cookies()
  if (cookieStore.get('trebass_view_as')?.value) return denyUnless(supabase, key)
  const { data, error } = await supabase.rpc('has_event_perm', { eid: eventId, key })
  if (error) return error.message
  return data === true ? null : 'Na tuhle akci nemáš oprávnění.'
}

// event_id řádku, ke kterému se akce vztahuje. null = řádek neexistuje,
// člověk ho nesmí vidět, nebo nepatří k žádné akci (úkol mimo akci).
async function eventIdOf(supabase: Awaited<ReturnType<typeof requireAuth>>, table: string, id: string): Promise<string | null> {
  const { data } = await supabase.from(table).select('event_id').eq('id', id).maybeSingle()
  return (data as { event_id: string | null } | null)?.event_id ?? null
}

// Přepíše, kdo (kromě adminů s admin_access_mode='all') má k akci přístup.
// Volá se po create/update eventu — nejjednodušší je vždy smazat staré řádky
// a nahrát nové, event_access nemá vlastní historii, kterou by bylo co zachovat.
async function syncEventAccess(
  supabase: Awaited<ReturnType<typeof requireAuth>>, eventId: string, profileIds: string[],
  exceptions: Record<string, Permissions> = {}
) {
  const { error: delError } = await supabase.from('event_access').delete().eq('event_id', eventId)
  if (delError) return delError.message
  const uniqueIds = [...new Set(profileIds)]
  if (uniqueIds.length === 0) return null
  const { error: insError } = await supabase
    .from('event_access')
    .insert(uniqueIds.map(profile_id => ({
      event_id: eventId, profile_id, permissions: sanitizeEventPermissions(exceptions[profile_id]),
    })))
  return insError?.message ?? null
}

// Výjimka smí obsahovat jen klíče uvnitř akce a jen hodnotu true — nic jiného
// (admin, Firma, správa lidí…) se přes výjimku udělit nesmí. Databáze má
// stejnou pojistku v is_event_perm_key().
function sanitizeEventPermissions(perms: Permissions | undefined): Permissions {
  const clean: Permissions = {}
  for (const key of EVENT_PERMISSION_KEYS) if (perms?.[key] === true) clean[key] = true
  return clean
}

// Kdo smí měnit, kdo má k akci přístup a s jakými výjimkami: admin nebo
// zakladatel akce (stejně jako politika event_access_write v DB).
async function canManageEventAccess(supabase: Awaited<ReturnType<typeof requireAuth>>, eventId: string): Promise<boolean> {
  const real = await realPermissions(supabase)
  if (real?.admin === true) return true
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('events').select('created_by').eq('id', eventId).maybeSingle()
  return !!user && data?.created_by === user.id
}

// EVENTS
export async function createEvent(form: {
  name: string; date: string; date_end: string; time_start: string; time_end: string
  location: string; type: string; status: string; description: string
  admin_access_mode?: 'all' | 'selected'; access_profile_ids?: string[]
  access_exceptions?: Record<string, Permissions>
  include_in_totals?: boolean
}) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canCreate')
  if (denied) return { error: denied }
  const payload = {
    name: form.name,
    date: form.date || null,
    date_end: form.date_end || null,
    time_start: form.time_start || null,
    time_end: form.time_end || null,
    location: form.location || null,
    type: form.type || null,
    status: form.status,
    description: form.description || null,
    admin_access_mode: form.admin_access_mode || 'all',
    include_in_totals: form.include_in_totals ?? true,
  }
  const { data, error } = await supabase.from('events').insert([payload]).select().single()
  if (error) return { error: error.message }
  const accessError = await syncEventAccess(supabase, data.id, form.access_profile_ids || [], form.access_exceptions)
  if (accessError) return { error: accessError }
  return { data }
}

export async function updateEvent(id: string, form: {
  name: string; date: string; date_end: string; time_start: string; time_end: string
  location: string; type: string; status: string; description: string
  admin_access_mode?: 'all' | 'selected'; access_profile_ids?: string[]
  access_exceptions?: Record<string, Permissions>
  include_in_totals?: boolean
}) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, id, 'canEdit')
  if (denied) return { error: denied }
  const payload = {
    name: form.name,
    date: form.date || null,
    date_end: form.date_end || null,
    time_start: form.time_start || null,
    time_end: form.time_end || null,
    location: form.location || null,
    type: form.type || null,
    status: form.status,
    description: form.description || null,
  }
  // Kdo akci vidí (a s jakými výjimkami) a jestli se počítá do přehledů,
  // smí měnit jen admin nebo zakladatel — editor přes výjimku jen zbytek.
  const manageAccess = await canManageEventAccess(supabase, id)
  const fullPayload = manageAccess
    ? { ...payload, admin_access_mode: form.admin_access_mode || 'all', include_in_totals: form.include_in_totals ?? true }
    : payload
  const { data: updated, error } = await supabase.from('events').update(fullPayload).eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'Akci se nepodařilo uložit (nemáš k ní přístup?).' }
  if (manageAccess) {
    const accessError = await syncEventAccess(supabase, id, form.access_profile_ids || [], form.access_exceptions)
    if (accessError) return { error: accessError }
  }
  return { data: true }
}

export async function updateEventStages(id: string, stages: string[]) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, id, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('events').update({ stages }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function updateEventEquipmentLocations(id: string, locations: string[]) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, id, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('events').update({ equipment_locations: locations }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function updateEventBudgets(id: string, budgets: Record<string, number>) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, id, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('events').update({ budgets }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function updateEventDescription(id: string, description: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, id, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('events').update({ description: description || null }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function updateEventMargin(id: string, margin_percent: number) {
  const marginError = invalidMargin(margin_percent)
  if (marginError) return { error: marginError }
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, id, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('events').update({ margin_percent }).eq('id', id)
  if (error) return { error: error.message }
  const syncError = await syncMarginIncome(supabase, id)
  if (syncError) return { error: syncError }
  return { data: true }
}

// Akce, které slouží jen jako soukromá kalkulačka, se nemají míchat do
// celkových součtů na Dashboardu a v Archivu.
export async function updateEventIncludeInTotals(id: string, include: boolean) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, id, 'canEdit')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('events').update({ include_in_totals: include }).eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Akci se nepodařilo uložit (nemáš k ní přístup?).' }
  return { data: true }
}

export async function updateEventMarginToIncome(id: string, enabled: boolean) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, id, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('events').update({ margin_to_income: enabled }).eq('id', id)
  if (error) return { error: error.message }
  const syncError = await syncMarginIncome(supabase, id)
  if (syncError) return { error: syncError }
  return { data: true }
}

// Drží řádek v `income` v souladu s náklady na techniku (expenses.price kde category='TECHNIKA')
// a nastavenou marží. Pokud je margin_to_income vypnuté, odpovídající příjem smaže.
async function syncMarginIncome(supabase: Awaited<ReturnType<typeof requireAuth>>, eventId: string): Promise<string | null> {
  const { data: event, error: eventError } = await supabase.from('events')
    .select('margin_percent, margin_to_income, margin_income_id').eq('id', eventId).single()
  if (eventError) return eventError.message
  if (!event) return null

  if (!event.margin_to_income) {
    if (event.margin_income_id) {
      const { error: deleteError } = await supabase.from('income').delete().eq('id', event.margin_income_id)
      if (deleteError) return deleteError.message
      const { error: clearError } = await supabase.from('events').update({ margin_income_id: null }).eq('id', eventId)
      if (clearError) return clearError.message
    }
    return null
  }

  const { data: techExpenses, error: techError } = await supabase.from('expenses')
    .select('price').eq('event_id', eventId).eq('category', 'TECHNIKA')
  if (techError) return techError.message
  const techCost = (techExpenses || []).reduce((s, e) => s + e.price, 0)
  const clientPrice = roundMoney(techCost * (1 + (event.margin_percent || 0) / 100))
  const note = 'Automaticky generováno z marže techniky'

  if (event.margin_income_id) {
    // Rozlišit „řádek už neexistuje" (legitimní důvod založit nový) od „operace selhala"
    // (přechodná chyba — nový řádek by znamenal duplicitní příjem).
    const { data: existing, error: findError } = await supabase.from('income')
      .select('id').eq('id', event.margin_income_id).maybeSingle()
    if (findError) return findError.message
    if (existing) {
      const { error: updateError } = await supabase.from('income')
        .update({ amount: clientPrice }).eq('id', event.margin_income_id)
      return updateError ? updateError.message : null
    }
    // Řádek byl skutečně smazaný → zahodit osiřelé id a založit nový níž.
    const { error: clearError } = await supabase.from('events').update({ margin_income_id: null }).eq('id', eventId)
    if (clearError) return clearError.message
  }
  const { data: inc, error: insertError } = await supabase.from('income')
    .insert([{ event_id: eventId, source: 'TECHNIKA (marže)', amount: clientPrice, note }]).select().single()
  if (insertError) return insertError.message
  if (!inc) return 'Nepodařilo se založit příjem z marže.'
  const { error: linkError } = await supabase.from('events').update({ margin_income_id: inc.id }).eq('id', eventId)
  return linkError ? linkError.message : null
}

// Sync je u těchhle akcí vedlejší efekt — hlavní operace už proběhla, takže se
// chyba nesmí vrátit jako selhání celé akce (uživatel by ji zopakoval a založil
// duplicitní výdaj). Zaloguje se na server, aby nezmizela beze stopy.
function logSyncError(where: string, syncError: string | null) {
  if (syncError) console.error(`[syncMarginIncome] ${where}: ${syncError}`)
}

// Peníze ukládat zaokrouhlené na celé koruny. Appka částky v drtivé většině míst
// zobrazuje bez desetinných míst, takže nezaokrouhlená hodnota (např. 112830.4914)
// by v součtech, exportech a odsouhlasování neseděla s tím, co uživatel vidí.
function roundMoney(n: number) {
  return Math.round(n)
}

// Sleva nad 100 % by dělala zápornou cenu; NaN/Infinity nesmí projít do DB.
function invalidDiscount(v: number | null | undefined) {
  if (v === null || v === undefined) return null
  if (!Number.isFinite(v) || v < 0 || v > 100) return 'Sleva musí být číslo v rozsahu 0–100 %.'
  return null
}

// Marže může být i vyšší než 100 % (dvojnásobek ceny), záporná ale ne — to by
// znamenalo prodej pod cenu a je to skoro jistě překlep.
function invalidMargin(v: number | null | undefined) {
  if (v === null || v === undefined) return null
  if (!Number.isFinite(v) || v < 0) return 'Marže musí být číslo větší nebo rovné nule.'
  return null
}

// EXPENSES
export async function createExpense(payload: {
  event_id: string; category: string; item: string; note: string | null;
  payment_timing: string | null; price: number; deposit: number; paid: boolean; discount_percent?: number; with_vat?: boolean
}) {
  const discountError = invalidDiscount(payload.discount_percent)
  if (discountError) return { error: discountError }
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, payload.event_id, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('expenses').insert([payload]).select().single()
  if (error) return { error: error.message }
  logSyncError('createExpense', await syncMarginIncome(supabase, payload.event_id))
  return { data }
}

export async function updateExpense(id: string, payload: {
  category: string; item: string; note: string | null;
  payment_timing: string | null; price: number; deposit: number; paid: boolean
}) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'expenses', id), 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('expenses').update(payload).eq('id', id)
  if (error) return { error: error.message }
  const { data: row } = await supabase.from('expenses').select('event_id').eq('id', id).single()
  if (row?.event_id) logSyncError('updateExpense', await syncMarginIncome(supabase, row.event_id))
  return { data: true }
}

export async function deleteExpense(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'expenses', id), 'canDelete')
  if (denied) return { error: denied }
  // event_id se musí zjistit ještě před smazáním, potom už řádek neexistuje
  const { data: row } = await supabase.from('expenses').select('event_id').eq('id', id).single()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return { error: error.message }
  if (row?.event_id) logSyncError('deleteExpense', await syncMarginIncome(supabase, row.event_id))
  return { data: true }
}

export async function renameExpenseItem(id: string, item: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'expenses', id), 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('expenses').update({ item }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function updateVendorDiscount(id: string, discount_percent: number) {
  const discountError = invalidDiscount(discount_percent)
  if (discountError) return { error: discountError }
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'expenses', id), 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('expenses').update({ discount_percent }).eq('id', id)
  if (error) return { error: error.message }
  await recalcExpensePrice(supabase, id)
  return { data: true }
}

export async function updateVendorVat(id: string, with_vat: boolean) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'expenses', id), 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('expenses').update({ with_vat }).eq('id', id)
  if (error) return { error: error.message }
  await recalcExpensePrice(supabase, id)
  return { data: true }
}

export async function unassignEquipmentByExpense(expenseId: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'expenses', expenseId), 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('event_equipment').update({ expense_id: null }).eq('expense_id', expenseId)
  if (error) return { error: error.message }
  return { data: true }
}

export async function toggleExpensePaid(id: string, paid: boolean) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'expenses', id), 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('expenses').update({ paid }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// INCOME
export async function createIncome(payload: {
  event_id: string; source: string; amount: number; note: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, payload.event_id, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('income').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateIncome(id: string, payload: {
  source: string; amount: number; note: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'income', id), 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('income').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteIncome(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'income', id), 'canDelete')
  if (denied) return { error: denied }
  const { error } = await supabase.from('income').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// LINEUP
// Částky (honorář, záloha, cesťák, zaplaceno) žijí v `lineup_fees`, kterou
// databáze vydá jen s oprávněním „Honoráře v Lineupu". Kdo je nevidí, posílá
// fees = undefined a jeho úprava se částek nedotkne (jinak by je přepsal nulou).
interface ArtistFees { fee: number; deposit: number; travel_cost: number; paid: boolean }
interface ArtistInfo {
  event_id: string; artist_name: string
  date: string | null; set_time: string | null; stage: string | null; notes: string | null
}

function lineupExpenseNote(stage: string | null, setTime: string | null) {
  const parts = [stage, setTime].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export async function createArtist(payload: ArtistInfo & { fees?: ArtistFees }) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, payload.event_id, 'canCreate')
  if (denied) return { error: denied }
  const { fees, ...info } = payload
  const { data, error } = await supabase.from('lineup').insert([info]).select().single()
  if (error) return { error: error.message }

  const f = fees ?? { fee: 0, deposit: 0, travel_cost: 0, paid: false }
  const { error: feeError } = await supabase.from('lineup_fees').insert([{ lineup_id: data.id, event_id: info.event_id, ...f }])
  if (feeError) return { error: feeError.message }

  // Sync to expenses — LINEUP category, linked via lineup_artist_id
  const { error: expError } = await supabase.from('expenses').insert([{
    event_id: info.event_id,
    category: 'LINEUP',
    item: info.artist_name,
    note: lineupExpenseNote(info.stage, info.set_time),
    payment_timing: null,
    price: f.fee + f.travel_cost,
    deposit: f.deposit,
    paid: f.paid,
    lineup_artist_id: data.id,
  }])
  if (expError) return { error: expError.message }

  return { data: { ...data, ...f } }
}

export async function updateArtist(id: string, payload: ArtistInfo & { fees?: ArtistFees }) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'lineup', id), 'canEdit')
  if (denied) return { error: denied }
  const { fees, ...info } = payload
  const { error } = await supabase.from('lineup').update(info).eq('id', id)
  if (error) return { error: error.message }

  if (fees) {
    const { error: feeError } = await supabase.from('lineup_fees')
      .upsert([{ lineup_id: id, event_id: info.event_id, ...fees }])
    if (feeError) return { error: feeError.message }
  }

  // Sync linked expense (částky jen když je člověk vidí a posílá)
  const { error: expError } = await supabase.from('expenses').update({
    item: info.artist_name,
    note: lineupExpenseNote(info.stage, info.set_time),
    ...(fees ? { price: fees.fee + fees.travel_cost, deposit: fees.deposit, paid: fees.paid } : {}),
  }).eq('lineup_artist_id', id)
  if (expError) return { error: expError.message }

  return { data: true }
}

export async function deleteArtist(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'lineup', id), 'canDelete')
  if (denied) return { error: denied }
  // Expense i lineup_fees se smažou automaticky přes ON DELETE CASCADE
  const { error } = await supabase.from('lineup').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function toggleArtistPaid(id: string, paid: boolean) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'lineup', id), 'canEdit')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('lineup_fees').update({ paid }).eq('lineup_id', id).select('lineup_id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Honorář se nepodařilo uložit (nemáš oprávnění k honorářům?).' }

  // Sync paid status to linked expense
  const { error: expError } = await supabase.from('expenses').update({ paid }).eq('lineup_artist_id', id)
  if (expError) return { error: expError.message }

  return { data: true }
}

// KNIHA MAJITELŮ (vklady, výběry, vyrovnání) — viz sql/2026-10-13_kniha_majitelu.sql
// Nahrazuje team_contributions (záložka Tým) a vklady/splátky majitelů ve Firmě.
type LedgerKind = 'vklad' | 'vyber' | 'vyrovnani' | 'dluh'
const isPairKind = (k: LedgerKind) => k === 'vyrovnani' || k === 'dluh'
interface LedgerPayload {
  profile_id: string; counterparty_id?: string | null; kind: LedgerKind; amount: number
  event_id: string | null; date: string | null; note: string | null
}

// Pohyby akce smí měnit i kdo má Tým v akci, pohyby Firmy jen kdo má Firmu.
// Stejné pravidlo jako can_ledger() v databázi (ta ho vynucuje i sama).
async function denyLedger(supabase: Awaited<ReturnType<typeof requireAuth>>, eventId: string | null, action: PermissionKey) {
  const { data, error } = await supabase.rpc('can_ledger', { eid: eventId, action })
  if (error) return error.message
  return data === true ? null : 'Na tuhle akci nemáš oprávnění.'
}

function invalidLedger(p: LedgerPayload): string | null {
  if (!p.profile_id) return 'Vyber, kdo peníze vložil nebo dostal.'
  if (!['vklad', 'vyber', 'vyrovnani', 'dluh'].includes(p.kind)) return 'Neplatný typ pohybu.'
  if (!Number.isFinite(p.amount) || p.amount <= 0) return 'Částka musí být kladné číslo.'
  if (p.kind === 'vyrovnani' && !p.counterparty_id) return 'U vyrovnání vyber, komu se peníze poslaly.'
  if (p.kind === 'dluh' && !p.counterparty_id) return 'U dluhu vyber, komu se dluží.'
  if (isPairKind(p.kind) && p.counterparty_id === p.profile_id) return 'Druhá strana musí být jiný člověk.'
  return null
}

function cleanLedger(p: LedgerPayload) {
  return {
    profile_id: p.profile_id,
    counterparty_id: isPairKind(p.kind) ? p.counterparty_id ?? null : null,
    kind: p.kind,
    amount: roundMoney(p.amount),
    event_id: p.event_id || null,
    date: p.date || null,
    note: p.note || null,
  }
}

export async function createLedgerEntry(payload: LedgerPayload) {
  const invalid = invalidLedger(payload)
  if (invalid) return { error: invalid }
  const supabase = await requireAuth()
  const denied = await denyLedger(supabase, payload.event_id || null, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('owner_ledger').insert([{ ...cleanLedger(payload), source: 'rucne' }]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateLedgerEntry(id: string, payload: LedgerPayload) {
  const invalid = invalidLedger(payload)
  if (invalid) return { error: invalid }
  const supabase = await requireAuth()
  const { data: prev } = await supabase.from('owner_ledger').select('event_id').eq('id', id).maybeSingle()
  if (!prev) return { error: 'Pohyb neexistuje nebo k němu nemáš přístup.' }
  // Přesun mezi akcemi / Firmou: smět upravit v původním i v novém místě
  const denied = await denyLedger(supabase, prev.event_id, 'canEdit')
    ?? await denyLedger(supabase, payload.event_id || null, 'canEdit')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('owner_ledger').update(cleanLedger(payload)).eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Pohyb se nepodařilo uložit.' }
  return { data: true }
}

export async function deleteLedgerEntry(id: string) {
  const supabase = await requireAuth()
  const { data: prev } = await supabase.from('owner_ledger').select('event_id').eq('id', id).maybeSingle()
  if (!prev) return { error: 'Pohyb neexistuje nebo k němu nemáš přístup.' }
  const denied = await denyLedger(supabase, prev.event_id, 'canDelete')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('owner_ledger').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Pohyb se nepodařilo smazat.' }
  return { data: true }
}

// Zapíše navržené převody z kalkulačky jako provedené: „firma → X" = výběr X,
// „A → B" = vyrovnání. Jedním insertem, ať se nezapíše jen půlka.
export async function recordSettlement(eventId: string | null, transfers: { from: string; to: string; amount: number }[], date: string | null, note: string | null) {
  if (!transfers.length) return { error: 'Není co zapsat.' }
  const rows: LedgerPayload[] = transfers.map(t => t.from === 'firma'
    ? { profile_id: t.to, kind: 'vyber', amount: t.amount, event_id: eventId, date, note }
    : { profile_id: t.from, counterparty_id: t.to, kind: 'vyrovnani', amount: t.amount, event_id: eventId, date, note })
  for (const r of rows) {
    const invalid = invalidLedger(r)
    if (invalid) return { error: invalid }
  }
  const supabase = await requireAuth()
  const denied = await denyLedger(supabase, eventId, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('owner_ledger')
    .insert(rows.map(r => ({ ...cleanLedger(r), source: 'kalkulacka' }))).select('id')
  if (error) return { error: error.message }
  return { data: (data || []).map(d => d.id as string) }
}

// Uzávěrka „Jsme vyrovnaní": všechny dosud otevřené pohyby se označí jako
// uzavřené. Zůstanou v historii, kalkulačka je ale už nepočítá. Smazání
// uzávěrky je zase otevře (closing_id on delete set null).
export async function closeLedger(closedOn: string | null, note: string | null) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'viewFirma') ?? await denyUnless(supabase, 'canEdit')
  if (denied) return { error: denied }
  const { count } = await supabase.from('owner_ledger').select('id', { count: 'exact', head: true }).is('closing_id', null)
  if (!count) return { error: 'Není co uzavřít — žádné otevřené pohyby.' }
  const { data: closing, error } = await supabase.from('ledger_closings')
    .insert([{ closed_on: closedOn || todayPrague(), note: note || null }]).select().single()
  if (error) return { error: error.message }
  const { data: updated, error: updError } = await supabase.from('owner_ledger')
    .update({ closing_id: closing.id }).is('closing_id', null).select('id')
  if (updError) {
    await supabase.from('ledger_closings').delete().eq('id', closing.id)
    return { error: updError.message }
  }
  // Kdyby RLS některé řádky tiše přeskočila (nemám k nim právo), uzávěrka
  // by byla jen částečná — to nechceme, vrátit zpět.
  if ((updated?.length ?? 0) !== count) {
    await supabase.from('ledger_closings').delete().eq('id', closing.id)
    return { error: 'Některé pohyby nemáš právo uzavřít — uzávěrku musí udělat admin.' }
  }
  return { data: { id: closing.id as string, count } }
}

export async function reopenLedgerClosing(closingId: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'viewFirma') ?? await denyUnless(supabase, 'canDelete')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('ledger_closings').delete().eq('id', closingId).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Uzávěrku se nepodařilo zrušit.' }
  return { data: true }
}

// Zůstatek na účtu firmy zadaný ručně z bankovnictví (s datem, ke kdy platí).
export async function setCompanyBalance(amount: number, asOf: string, note: string | null) {
  if (!Number.isFinite(amount)) return { error: 'Zůstatek musí být číslo.' }
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'viewFirma') ?? await denyUnless(supabase, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('company_balance')
    .insert([{ amount: roundMoney(amount), as_of: asOf || todayPrague(), note: note || null }]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function deleteEvent(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canDeleteEvent')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('events').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Akci se nepodařilo smazat (nemáš k ní přístup?).' }
  return { data: true }
}

// DOCUMENTS
export async function deleteDocument(id: string, filePath: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'documents', id), 'canDelete')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('documents').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Soubor se nepodařilo smazat (nemáš k němu přístup?).' }
  await supabase.storage.from('documents').remove([filePath])
  return { data: true }
}

// NOTES
export async function createNote(payload: { event_id: string; author: string; content: string }) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, payload.event_id, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('notes').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function deleteNote(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'notes', id), 'canDelete')
  if (denied) return { error: denied }
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// CONTACTS
export async function createContact(payload: {
  name: string; type: string; fee: number; email: string | null; phone: string | null; note: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('contacts').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateContact(id: string, payload: {
  name: string; type: string; fee: number; email: string | null; phone: string | null; note: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('contacts').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteContact(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canDelete')
  if (denied) return { error: denied }
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// TASKS
export async function createTask(payload: {
  title: string; description: string | null; assigned_to_members: string[];
  status: string; priority: string; due_date: string | null; event_id: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, payload.event_id, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('tasks').insert([{ ...payload, assigned_to: null }]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateTask(id: string, payload: {
  title: string; description: string | null; assigned_to_members: string[];
  status: string; priority: string; due_date: string | null; event_id: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'tasks', id), 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('tasks').update({ ...payload, assigned_to: null }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function updateTaskStatus(id: string, status: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'tasks', id), 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteTask(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'tasks', id), 'canDelete')
  if (denied) return { error: denied }
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// COMPANY (FIRMA)
export async function createCompanyExpense(payload: {
  category: string; item: string; note: string | null; amount: number; paid: boolean; date: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('company_expenses').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateCompanyExpense(id: string, payload: {
  category: string; item: string; note: string | null; amount: number; paid: boolean; date: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('company_expenses').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteCompanyExpense(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canDelete')
  if (denied) return { error: denied }
  const { error } = await supabase.from('company_expenses').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function toggleCompanyExpensePaid(id: string, paid: boolean) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('company_expenses').update({ paid }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function createCompanyIncome(payload: {
  source: string; name: string | null; amount: number; note: string | null; date: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('company_income').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateCompanyIncome(id: string, payload: {
  source: string; name: string | null; amount: number; note: string | null; date: string | null
}) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canEdit')
  if (denied) return { error: denied }
  const { error } = await supabase.from('company_income').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteCompanyIncome(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'canDelete')
  if (denied) return { error: denied }
  const { error } = await supabase.from('company_income').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// EQUIPMENT (TECHNIKA)
async function recalcExpensePrice(supabase: Awaited<ReturnType<typeof requireAuth>>, expenseId: string | null) {
  if (!expenseId) return
  const [{ data }, { data: exp }] = await Promise.all([
    supabase.from('event_equipment').select('total_price').eq('expense_id', expenseId),
    supabase.from('expenses').select('discount_percent, with_vat, event_id').eq('id', expenseId).single(),
  ])
  const sum = (data || []).reduce((s, e) => s + e.total_price, 0)
  const discount = exp?.discount_percent || 0
  const vatMultiplier = exp?.with_vat ? 1.21 : 1
  await supabase.from('expenses').update({ price: roundMoney(sum * (1 - discount / 100) * vatMultiplier) }).eq('id', expenseId)
  if (exp?.event_id) logSyncError('recalcExpensePrice', await syncMarginIncome(supabase, exp.event_id))
}

export async function createEquipment(payload: {
  event_id: string; name: string; note: string | null; quantity: number; unit_price: number; total_price: number
  expense_id: string | null; category: string | null; location: string | null; power_kw: number; elektrina_extra?: boolean
}) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, payload.event_id, 'canCreate')
  if (denied) return { error: denied }
  const { data, error } = await supabase.from('event_equipment').insert([payload]).select().single()
  if (error) return { error: error.message }
  await recalcExpensePrice(supabase, payload.expense_id)
  return { data }
}

export async function updateEquipment(id: string, payload: {
  name: string; note: string | null; quantity: number; unit_price: number; total_price: number
  expense_id: string | null; category: string | null; location: string | null; power_kw: number; elektrina_extra?: boolean
}) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'event_equipment', id), 'canEdit')
  if (denied) return { error: denied }
  const { data: prev } = await supabase.from('event_equipment').select('expense_id').eq('id', id).single()
  const { error } = await supabase.from('event_equipment').update(payload).eq('id', id)
  if (error) return { error: error.message }
  await recalcExpensePrice(supabase, payload.expense_id)
  if (prev?.expense_id && prev.expense_id !== payload.expense_id) await recalcExpensePrice(supabase, prev.expense_id)
  return { data: true }
}

export async function deleteEquipment(id: string) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, await eventIdOf(supabase, 'event_equipment', id), 'canDelete')
  if (denied) return { error: denied }
  const { data: prev } = await supabase.from('event_equipment').select('expense_id').eq('id', id).single()
  const { error } = await supabase.from('event_equipment').delete().eq('id', id)
  if (error) return { error: error.message }
  await recalcExpensePrice(supabase, prev?.expense_id ?? null)
  return { data: true }
}

// UNDO
const RESTORABLE_TABLES = [
  'expenses', 'income', 'contacts', 'notes', 'tasks',
  'owner_ledger', 'company_expenses', 'company_income', 'event_equipment',
] as const
type RestorableTable = typeof RESTORABLE_TABLES[number]

export async function restoreRow(table: RestorableTable, row: Record<string, unknown>) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, row.event_id as string | undefined, 'canCreate')
  if (denied) return { error: denied }
  if (!RESTORABLE_TABLES.includes(table)) return { error: 'Neplatná tabulka pro obnovení' }
  const { error } = await supabase.from(table).insert([row])
  if (error) return { error: error.message }
  if (table === 'event_equipment' && row.expense_id) {
    await recalcExpensePrice(supabase, row.expense_id as string)
  }
  return { data: true }
}

export async function restoreArtist(row: ArtistInfo & { id: string; fees?: ArtistFees }) {
  const supabase = await requireAuth()
  const denied = await denyUnlessEvent(supabase, row.event_id, 'canCreate')
  if (denied) return { error: denied }
  const { fees, ...info } = row
  const { error } = await supabase.from('lineup').insert([info])
  if (error) return { error: error.message }

  const f = fees ?? { fee: 0, deposit: 0, travel_cost: 0, paid: false }
  const { error: feeError } = await supabase.from('lineup_fees').insert([{ lineup_id: row.id, event_id: row.event_id, ...f }])
  if (feeError) return { error: feeError.message }

  const { error: expError } = await supabase.from('expenses').insert([{
    event_id: row.event_id,
    category: 'LINEUP',
    item: row.artist_name,
    note: lineupExpenseNote(row.stage, row.set_time),
    payment_timing: null,
    price: f.fee + f.travel_cost,
    deposit: f.deposit,
    paid: f.paid,
    lineup_artist_id: row.id,
  }])
  if (expError) return { error: expError.message }

  return { data: true }
}

// SPRÁVA UŽIVATELŮ A ROLÍ
// Pojistky proti zamčení jsou tu podstatnější než samotné přiřazení: minulý
// pokus o role se musel druhý den vypnout, protože se lidi nedostali dovnitř.
export async function assignRole(profileId: string, roleId: string | null) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'manageUsers')
  if (denied) return { error: denied }

  const { data: newRole } = roleId
    ? await supabase.from('roles').select('permissions').eq('id', roleId).single()
    : { data: null }
  const wouldBeAdmin = (newRole as { permissions?: Permissions } | null)?.permissions?.admin === true

  // Pojistka 0: manageUsers samo o sobě neopravňuje udělit roli s admin:true
  // (typicky přímo roli Admin) — bez tohohle by šlo obejít manageRoles
  // a rovnou se (nebo někoho jiného) povýšit na plného administrátora.
  if (wouldBeAdmin) {
    const real = await realPermissions(supabase)
    if (real?.admin !== true) {
      return { error: 'Jen administrátor smí přiřadit administrátorskou roli.' }
    }
  }

  // Pojistka 1: nikdo si nesmí sebrat vlastní administrátorská práva.
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === profileId && !wouldBeAdmin) {
    const perms = await currentPermissions(supabase)
    if (perms?.admin === true) {
      return { error: 'Nemůžeš si sebrat vlastní administrátorská práva. Ať ti roli změní jiný admin.' }
    }
  }

  // Pojistka 2: v systému musí zůstat aspoň jeden administrátor.
  const { data: everyone } = await supabase.from('profiles').select('id, roles(permissions)')
  const adminsAfter = (everyone || []).filter(row => {
    const rel = (row as Record<string, unknown>).roles
    const role = (Array.isArray(rel) ? rel[0] : rel) as { permissions?: Permissions } | null | undefined
    const isAdmin = role?.permissions?.admin === true
    return (row as { id: string }).id === profileId ? wouldBeAdmin : isAdmin
  }).length
  if (adminsAfter === 0) {
    return { error: 'Musí zůstat aspoň jeden administrátor. Nejdřív povyš někoho jiného.' }
  }

  const admin = getAdminClient()
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený v .env.local.' }
  const { error } = await admin.from('profiles').update({ role_id: roleId }).eq('id', profileId)
  if (error) return { error: error.message }
  return { data: true }
}

// Auth Admin API (vytváření/mazání účtů, změna hesla/e-mailu jiného člověka)
// vyžaduje service_role klíč — anon klíč na to nestačí ani nesmí. Klíč se
// používá jen tady, jen na serveru, nikdy v prohlížeči.
function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Math.random() není kryptograficky bezpečný RNG (jde v principu předvídat) —
// pro heslo, byť jednorázové, patří crypto.getRandomValues.
function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

// Založení nového člověka pod vlastním uživatelským jménem a heslem (náhrada
// za sdílené účty admin/clen/host). Žádný e-mail se nikam neposílá — admin
// rovnou zadá jméno, přihlašovací jméno a heslo a řekne mu je osobně, stejně
// jako se dřív předávaly sdílené přístupy. must_change_password=true donutí
// člověka si při prvním přihlášení nastavit heslo, které admin už neuvidí.
export async function createUser(name: string, username: string, password: string, roleId: string | null) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'manageUsers')
  if (denied) return { error: denied }

  const trimmedName = name.trim()
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  if (!trimmedName) return { error: 'Jméno je povinné.' }
  if (!cleanUsername) return { error: 'Neplatné uživatelské jméno (jen písmena, čísla, tečka, pomlčka).' }
  if (password.length < 6) return { error: 'Heslo musí mít aspoň 6 znaků.' }

  // manageUsers samo o sobě neopravňuje rovnou založit dalšího admina —
  // stejná pojistka jako u assignRole.
  if (roleId) {
    const { data: newRole } = await supabase.from('roles').select('permissions').eq('id', roleId).single()
    if ((newRole as { permissions?: Permissions } | null)?.permissions?.admin === true) {
      const real = await realPermissions(supabase)
      if (real?.admin !== true) return { error: 'Jen administrátor smí založit účet s administrátorskou rolí.' }
    }
  }

  const admin = getAdminClient()
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený v .env.local — bez něj nejde účty zakládat.' }

  const email = `${cleanUsername}@trebass.cz`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: trimmedName },
  })
  if (createError) {
    if (createError.message.toLowerCase().includes('already been registered')) {
      return { error: `Uživatelské jméno „${cleanUsername}" už existuje.` }
    }
    return { error: createError.message }
  }
  if (!created.user) return { error: 'Účet se nevytvořil (neznámá chyba).' }

  // upsert, ne insert: DB má trigger, který profil založí hned s uživatelem
  // (bez role), takže tady jen doplňujeme jméno/e-mail/roli na existující řádek.
  const { error: profileError } = await admin
    .from('profiles')
    .upsert([{ id: created.user.id, name: trimmedName, email, role_id: roleId, must_change_password: true }])
  if (profileError) return { error: profileError.message }

  return { data: { id: created.user.id, name: trimmedName, email, phone: null, role_id: roleId } }
}

// Upraví jméno, uživatelské jméno a telefon. Změna uživatelského jména =
// změna e-mailu v Auth (login je postavený na `${username}@trebass.cz`),
// proto jde přes service_role, ne přes běžný update.
export async function updateProfile(profileId: string, name: string, username: string, phone: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'manageUsers')
  if (denied) return { error: denied }

  const trimmedName = name.trim()
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  const trimmedPhone = phone.trim()
  if (!trimmedName) return { error: 'Jméno je povinné.' }
  if (!cleanUsername) return { error: 'Neplatné uživatelské jméno (jen písmena, čísla, tečka, pomlčka).' }

  const admin = getAdminClient()
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený v .env.local.' }

  const email = `${cleanUsername}@trebass.cz`
  const { error: authError } = await admin.auth.admin.updateUserById(profileId, { email, email_confirm: true })
  if (authError) {
    if (authError.message.toLowerCase().includes('already been registered')) {
      return { error: `Uživatelské jméno „${cleanUsername}" už existuje.` }
    }
    return { error: authError.message }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ name: trimmedName, email, phone: trimmedPhone || null })
    .eq('id', profileId)
  if (profileError) return { error: profileError.message }

  return { data: { id: profileId, name: trimmedName, email, phone: trimmedPhone || null } }
}

// Pojistky proti zamčení stejné jako u assignRole: nikdo si nesmí smazat sám
// sebe a musí zůstat aspoň jeden administrátor.
export async function deleteUser(profileId: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'manageUsers')
  if (denied) return { error: denied }

  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === profileId) return { error: 'Nemůžeš smazat vlastní účet.' }

  const { data: everyone } = await supabase.from('profiles').select('id, roles(permissions)')
  const adminsAfter = (everyone || []).filter(row => {
    const rel = (row as Record<string, unknown>).roles
    const role = (Array.isArray(rel) ? rel[0] : rel) as { permissions?: Permissions } | null | undefined
    return (row as { id: string }).id !== profileId && role?.permissions?.admin === true
  }).length
  const wasAdmin = (everyone || []).some(row => {
    const rel = (row as Record<string, unknown>).roles
    const role = (Array.isArray(rel) ? rel[0] : rel) as { permissions?: Permissions } | null | undefined
    return (row as { id: string }).id === profileId && role?.permissions?.admin === true
  })
  if (wasAdmin && adminsAfter === 0) {
    return { error: 'Musí zůstat aspoň jeden administrátor. Nejdřív povyš někoho jiného.' }
  }

  const admin = getAdminClient()
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený v .env.local.' }

  const { error } = await admin.auth.admin.deleteUser(profileId)
  if (error) return { error: error.message }
  return { data: true }
}

// Vygeneruje nové jednorázové heslo a donutí člověka si při přihlášení
// nastavit vlastní. Admin ho vidí přesně jednou — hned v odpovědi — a musí
// ho člověku řekl osobně, stejně jako při založení účtu (appka nemá e-mail).
export async function resetPassword(profileId: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'manageUsers')
  if (denied) return { error: denied }

  const admin = getAdminClient()
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený v .env.local.' }

  const newPassword = randomPassword()
  const { error: authError } = await admin.auth.admin.updateUserById(profileId, { password: newPassword })
  if (authError) return { error: authError.message }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', profileId)
  if (profileError) return { error: profileError.message }

  return { data: { password: newPassword } }
}

export async function updateRolePermissions(roleId: string, permissions: Permissions) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'manageRoles')
  if (denied) return { error: denied }

  // manageRoles bez admin:true nesmí udělit admin:true — jinak by role
  // "spravovat role" + "přiřazovat role lidem" dohromady byla tichá cesta
  // k plným admin právům. Kontroluje se skutečná role, ne aktivní náhled.
  if (permissions?.admin === true) {
    const real = await realPermissions(supabase)
    if (real?.admin !== true) {
      return { error: 'Jen administrátor smí roli udělit administrátorská práva.' }
    }
  }

  const admin = getAdminClient()
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený v .env.local.' }
  const { error } = await admin.from('roles').update({ permissions }).eq('id', roleId)
  if (error) return { error: error.message }
  return { data: true }
}

export async function renameRole(roleId: string, name: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'manageRoles')
  if (denied) return { error: denied }
  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Název role je povinný.' }
  const admin = getAdminClient()
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený v .env.local.' }
  const { error } = await admin.from('roles').update({ name: trimmedName }).eq('id', roleId)
  if (error) {
    if (error.message.toLowerCase().includes('duplicate')) return { error: `Role „${trimmedName}" už existuje.` }
    return { error: error.message }
  }
  return { data: true }
}

export async function createRole(name: string, color: string) {
  const supabase = await requireAuth()
  const denied = await denyUnless(supabase, 'manageRoles')
  if (denied) return { error: denied }
  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Název role je povinný.' }
  const admin = getAdminClient()
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený v .env.local.' }
  const { data, error } = await admin
    .from('roles')
    .insert([{ name: trimmedName, color, permissions: {}, is_system: false }])
    .select()
    .single()
  if (error) {
    if (error.message.toLowerCase().includes('duplicate')) return { error: `Role „${trimmedName}" už existuje.` }
    return { error: error.message }
  }
  return { data }
}
