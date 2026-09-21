// Katalog oprávnění. Role samotné žijí v DB (tabulka `roles`), tady je jen
// seznam přepínačů, které kód umí kontrolovat, jejich popisky a výchozí hodnoty.
// Nové oprávnění = přidat sem klíč a doplnit kontrolu na místě, kde se vynucuje.

export type PermissionKey =
  // Sekce v hlavní navigaci
  | 'viewDashboard' | 'viewFirma' | 'viewAkce' | 'viewKalendar'
  | 'viewUkoly' | 'viewKontakty' | 'viewArchiv'
  // Záložky uvnitř akce
  | 'viewPrehled' | 'viewVydaje' | 'viewPrijmy' | 'viewLineup' | 'viewTechnika'
  | 'viewElektrina' | 'viewTym' | 'viewChat' | 'viewSoubory'
  // Citlivé údaje
  | 'viewLineupFees'
  // Co smí měnit
  | 'canCreate' | 'canEdit' | 'canDelete' | 'canDeleteEvent'
  // Správa
  | 'manageUsers' | 'manageRoles'
  // Zkratka „všechno" — role s tímhle přepínačem má automaticky vše ostatní.
  // Díky tomu nemusí Admin dostávat nově přidaná oprávnění ručně.
  | 'admin'

export type Permissions = Partial<Record<PermissionKey, boolean>>

export interface Role {
  id: string
  name: string
  color: string
  permissions: Permissions
  is_system: boolean
}

interface PermissionMeta {
  key: PermissionKey
  label: string
  hint?: string
}

// Seskupení pro budoucí konzoli — pořadí tady určuje pořadí na obrazovce.
export const PERMISSION_GROUPS: { label: string; permissions: PermissionMeta[] }[] = [
  {
    label: 'Sekce',
    permissions: [
      { key: 'viewDashboard', label: 'Dashboard' },
      { key: 'viewAkce', label: 'Akce' },
      { key: 'viewFirma', label: 'Firma', hint: 'Firemní výdaje a příjmy mimo akce' },
      { key: 'viewKalendar', label: 'Kalendář' },
      { key: 'viewUkoly', label: 'Úkoly' },
      { key: 'viewKontakty', label: 'Kontakty' },
      { key: 'viewArchiv', label: 'Archiv' },
    ],
  },
  {
    label: 'Záložky v akci',
    permissions: [
      { key: 'viewPrehled', label: 'Přehled', hint: 'Bilance, breakdown kategorií, rozpočty' },
      { key: 'viewVydaje', label: 'Výdaje' },
      { key: 'viewPrijmy', label: 'Příjmy' },
      { key: 'viewLineup', label: 'Lineup' },
      { key: 'viewLineupFees', label: 'Honoráře v Lineupu', hint: 'Bez tohohle vidí jména, ale ne částky' },
      { key: 'viewTechnika', label: 'Technika' },
      { key: 'viewElektrina', label: 'Elektřina' },
      { key: 'viewTym', label: 'Tým' },
      { key: 'viewChat', label: 'Chat' },
      { key: 'viewSoubory', label: 'Soubory' },
    ],
  },
  {
    label: 'Úpravy',
    permissions: [
      { key: 'canCreate', label: 'Vytvářet záznamy' },
      { key: 'canEdit', label: 'Upravovat záznamy' },
      { key: 'canDelete', label: 'Mazat záznamy' },
      { key: 'canDeleteEvent', label: 'Mazat celé akce', hint: 'Nevratné — smaže i všechny výdaje, příjmy a techniku akce' },
    ],
  },
  {
    label: 'Správa',
    permissions: [
      { key: 'manageUsers', label: 'Přiřazovat role lidem' },
      { key: 'manageRoles', label: 'Vytvářet a upravovat role' },
      { key: 'admin', label: 'Administrátor', hint: 'Automaticky uděluje všechna oprávnění, i budoucí' },
    ],
  },
]

export const ALL_PERMISSION_KEYS: PermissionKey[] =
  PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key))

export const PERMISSION_LABELS: Record<string, string> =
  Object.fromEntries(PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => [p.key, p.label])))

// Výchozí sada pro Crew Member: dobrovolníci/technici vidí jen provozní věci
// na akcích, na které mají přístup (viz event_access) — žádné finance, žádný
// Dashboard, žádný Přehled akce. Úkoly vidí všechny napříč akcemi. Doladit
// se dá v konzoli, aniž by se sahalo do kódu.
export const CREW_DEFAULTS: Permissions = {
  viewAkce: true, viewUkoly: true,
  viewLineup: true, viewTechnika: true, viewElektrina: true,
  viewTym: true, viewChat: true, viewSoubory: true,
  canCreate: true, canEdit: true,
}

export const ADMIN_DEFAULTS: Permissions = { admin: true }

/**
 * Jediné místo, kde se rozhoduje o oprávnění.
 *
 * `permissions === null` znamená „uživatel nemá přiřazenou žádnou roli".
 * V tom případě se **povolí vše**. Je to vědomé rozhodnutí, ne opomenutí:
 * appka dosud žádné role neměla a všichni přihlášení měli plný přístup,
 * takže zamykat lidi ven kvůli nedoběhlé migraci by bylo horší než nechat
 * je pracovat. Jakmile má uživatel roli přiřazenou, vynucuje se přísně.
 *
 * Pozor: `undefined` (= role se teprve načítá) se tu neřeší — na to má
 * volající kód vlastní „načítám" stav. Právě splynutí „načítám" se „zakázáno"
 * potopilo minulý pokus o role.
 */
export function hasPermission(permissions: Permissions | null, key: PermissionKey): boolean {
  if (permissions === null) return true
  if (permissions.admin === true) return true
  return permissions[key] === true
}
