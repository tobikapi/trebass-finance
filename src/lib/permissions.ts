export type Role = 'admin' | 'clen' | 'host'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  clen: 'Člen',
  host: 'Host',
}

export const ROLE_COLORS: Record<Role, string> = {
  admin: '#e05555',
  clen: '#60a5fa',
  host: '#34d399',
}

type PermissionMap = {
  viewDashboard: boolean
  viewAkce: boolean
  viewVydaje: boolean
  viewPrijmy: boolean
  viewLineup: boolean
  viewLineupFees: boolean
  viewTym: boolean
  viewPoznamky: boolean
  viewSoubory: boolean
  viewUkoly: boolean
  viewKontakty: boolean
  viewArchiv: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canManageUsers: boolean
}

export type Permission = keyof PermissionMap

export const PERMISSIONS: Record<Role, PermissionMap> = {
  admin: {
    viewDashboard: true, viewAkce: true, viewVydaje: true, viewPrijmy: true,
    viewLineup: true, viewLineupFees: true, viewTym: true, viewPoznamky: true,
    viewSoubory: true, viewUkoly: true, viewKontakty: true, viewArchiv: true,
    canCreate: true, canEdit: true, canDelete: true, canManageUsers: true,
  },
  clen: {
    viewDashboard: true, viewAkce: true, viewVydaje: true, viewPrijmy: true,
    viewLineup: true, viewLineupFees: true, viewTym: true, viewPoznamky: true,
    viewSoubory: true, viewUkoly: true, viewKontakty: true, viewArchiv: true,
    canCreate: true, canEdit: true, canDelete: false, canManageUsers: false,
  },
  host: {
    viewDashboard: false, viewAkce: true, viewVydaje: false, viewPrijmy: false,
    viewLineup: true, viewLineupFees: false, viewTym: false, viewPoznamky: false,
    viewSoubory: true, viewUkoly: false, viewKontakty: false, viewArchiv: false,
    canCreate: false, canEdit: false, canDelete: false, canManageUsers: false,
  },
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return PERMISSIONS[role]?.[permission] ?? false
}
