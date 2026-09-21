'use client'

import { useState } from 'react'
import { callAction } from '@/lib/call-action'
import { useDialog } from '@/lib/dialog-context'
import { useUser } from '@/lib/user-context'
import { PERMISSION_GROUPS, type Permissions, type Role } from '@/lib/permissions'

interface ProfileRow {
  id: string
  name: string | null
  email: string | null
  role_id: string | null
}

interface Props {
  initialProfiles: ProfileRow[]
  initialRoles: Role[]
}

function RoleBadge({ role }: { role: Role | undefined }) {
  if (!role) {
    return (
      <span
        title="Bez role má uživatel zatím plný přístup — přiřaď mu roli, aby se omezení začalo vynucovat"
        style={{
          fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
          color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.12)',
          border: '1px solid rgba(251,191,36,0.35)',
        }}
      >
        bez role
      </span>
    )
  }
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
      color: role.color, backgroundColor: `${role.color}1f`, border: `1px solid ${role.color}59`,
    }}>
      {role.name}
    </span>
  )
}

const ROLE_COLORS = ['#e05555', '#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6']

function RoleEditorCard({ role, onSaved }: { role: Role; onSaved: (updated: Role) => void }) {
  const { notify } = useDialog()
  const [name, setName] = useState(role.name)
  const [draft, setDraft] = useState<Permissions>(role.permissions || {})
  const [saving, setSaving] = useState(false)
  const isAdminRole = role.permissions?.admin === true
  const dirty = name.trim() !== role.name || JSON.stringify(draft) !== JSON.stringify(role.permissions || {})

  function toggle(key: keyof Permissions) {
    setDraft(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function save() {
    setSaving(true)
    if (name.trim() !== role.name) {
      const renameResult = await callAction<{ data?: boolean; error?: string }>('renameRole', role.id, name.trim())
      if (renameResult.error) { setSaving(false); notify(renameResult.error); return }
    }
    if (!isAdminRole && JSON.stringify(draft) !== JSON.stringify(role.permissions || {})) {
      const permResult = await callAction<{ data?: boolean; error?: string }>('updateRolePermissions', role.id, draft)
      if (permResult.error) { setSaving(false); notify(permResult.error); return }
    }
    setSaving(false)
    onSaved({ ...role, name: name.trim(), permissions: draft })
  }

  return (
    <div style={{
      borderRadius: '12px', border: '1px solid var(--border-card)',
      backgroundColor: 'var(--bg-card-alt)', padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          value={name} onChange={e => setName(e.target.value)}
          style={{
            fontSize: '13px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px',
            color: role.color, backgroundColor: `${role.color}1f`, border: `1px solid ${role.color}59`,
            outline: 'none', width: `${Math.max(name.length, 6) + 3}ch`,
          }}
        />
        {isAdminRole && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            má automaticky všechna oprávnění, i ta, která teprve přibudou
          </span>
        )}
        {dirty && (
          <button
            onClick={save} disabled={saving}
            style={{
              marginLeft: 'auto', padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
              backgroundColor: saving ? '#7a2e2e' : '#e05555', color: '#fff', border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        )}
      </div>

      {!isAdminRole && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {PERMISSION_GROUPS.filter(g => g.label !== 'Správa').map(group => (
            <div key={group.label}>
              <div style={{
                fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
              }}>
                {group.label}
              </div>
              {group.permissions.map(perm => (
                <label key={perm.key} title={perm.hint} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '4px',
                  color: draft[perm.key] ? 'var(--text-primary)' : 'var(--text-dim)', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={draft[perm.key] === true} onChange={() => toggle(perm.key)} />
                  {perm.label}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PersonRow({ profile, role, roles, isMe, disabled, saving, onChangeRole, onUpdated, onDeleted }: {
  profile: ProfileRow; role: Role | undefined; roles: Role[]; isMe: boolean; disabled: boolean; saving: boolean
  onChangeRole: (roleId: string) => void
  onUpdated: (updated: ProfileRow) => void
  onDeleted: () => void
}) {
  const { notify } = useDialog()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name || '')
  const [username, setUsername] = useState(profile.email?.replace(/@trebass\.cz$/, '') || '')
  const [busy, setBusy] = useState(false)

  async function saveEdit() {
    setBusy(true)
    const result = await callAction<{ data?: ProfileRow; error?: string }>('updateProfile', profile.id, name, username)
    setBusy(false)
    if (result.error) { notify(result.error); return }
    if (result.data) onUpdated({ ...profile, ...result.data })
    setEditing(false)
  }

  async function resetPassword() {
    if (!confirm(`Vygenerovat nové heslo pro ${profile.name || username}? Staré přestane platit.`)) return
    setBusy(true)
    const result = await callAction<{ data?: { password: string }; error?: string }>('resetPassword', profile.id)
    setBusy(false)
    if (result.error) { notify(result.error); return }
    if (result.data) {
      notify(`Nové heslo pro ${profile.name || username}: ${result.data.password}\n\nŘekni mu ho osobně — při přihlášení si nastaví vlastní.`)
    }
  }

  async function del() {
    if (!confirm(`Smazat účet „${profile.name || username}"? Nevratné.`)) return
    setBusy(true)
    const result = await callAction<{ data?: boolean; error?: string }>('deleteUser', profile.id)
    setBusy(false)
    if (result.error) { notify(result.error); return }
    onDeleted()
  }

  const cellStyle = {
    width: '100%', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' as const,
    backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 150px 200px 190px', gap: '12px',
      alignItems: 'center', padding: '12px 18px',
      borderTop: '1px solid var(--border-card)',
      opacity: saving || busy ? 0.5 : 1,
    }}>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Jméno" style={cellStyle} />
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="uživatelské jméno" style={cellStyle} />
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {profile.name || '—'}
            {isMe && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>(ty)</span>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{username || '—'}</div>
        </div>
      )}
      <div><RoleBadge role={role} /></div>
      <div>
        <select
          value={profile.role_id || ''}
          disabled={saving || disabled}
          onChange={e => onChangeRole(e.target.value)}
          style={{
            width: '100%', padding: '7px 10px', borderRadius: '8px', fontSize: '13px',
            backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)',
            border: '1px solid var(--border-card)',
          }}
        >
          <option value="">— bez role —</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {editing ? (
          <>
            <button onClick={saveEdit} disabled={busy} style={actionBtnStyle('#e05555')}>Uložit</button>
            <button onClick={() => setEditing(false)} disabled={busy} style={actionBtnStyle()}>Zpět</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} disabled={busy} style={actionBtnStyle()}>Upravit</button>
            <button onClick={resetPassword} disabled={busy} style={actionBtnStyle()}>Reset heslo</button>
            {!isMe && <button onClick={del} disabled={busy} style={actionBtnStyle('#e05555')}>Smazat</button>}
          </>
        )}
      </div>
    </div>
  )
}

function actionBtnStyle(color?: string): React.CSSProperties {
  return {
    fontSize: '11px', padding: '4px 9px', borderRadius: '6px', cursor: 'pointer',
    backgroundColor: 'transparent', color: color || 'var(--text-secondary)',
    border: `1px solid ${color ? color + '59' : 'var(--border-card)'}`,
  }
}

export default function AdminClient({ initialProfiles, initialRoles }: Props) {
  const { notify } = useDialog()
  const { user } = useUser()
  const [profiles, setProfiles] = useState<ProfileRow[]>(initialProfiles)
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [newRoleName, setNewRoleName] = useState('')
  const [creatingRole, setCreatingRole] = useState(false)

  async function addRole(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newRoleName.trim()) return
    setCreatingRole(true)
    const color = ROLE_COLORS[roles.length % ROLE_COLORS.length]
    const result = await callAction<{ data?: Role; error?: string }>('createRole', newRoleName.trim(), color)
    setCreatingRole(false)
    if (result.error) { notify(result.error); return }
    if (result.data) setRoles(prev => [...prev, result.data as Role])
    setNewRoleName('')
  }

  const [newName, setNewName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRoleId, setNewRoleId] = useState(roles.find(r => r.name === 'Crew Member' || r.name === 'Člen')?.id || '')
  const [creating, setCreating] = useState(false)

  const rolesById = new Map(roles.map(r => [r.id, r]))
  const migrationMissing = roles.length === 0

  async function createNewUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newName.trim() || !newUsername.trim() || !newPassword) return

    setCreating(true)
    const result = await callAction<{ data?: ProfileRow; error?: string }>(
      'createUser', newName.trim(), newUsername.trim(), newPassword, newRoleId || null
    )
    setCreating(false)

    if (result.error) {
      notify(result.error)
      return
    }
    if (result.data) {
      setProfiles(prev => [...prev, result.data as ProfileRow])
    }
    notify(`Účet „${newUsername.trim()}" založen. Řekni mu jméno a heslo osobně.`)
    setNewName('')
    setNewUsername('')
    setNewPassword('')
  }

  async function changeRole(profileId: string, roleId: string) {
    const previous = profiles.find(p => p.id === profileId)?.role_id ?? null
    const next = roleId || null
    if (next === previous) return

    setSavingId(profileId)
    setProfiles(prev => prev.map(p => (p.id === profileId ? { ...p, role_id: next } : p)))

    const result = await callAction('assignRole', profileId, next)
    setSavingId(null)

    if (result.error) {
      // Vrátit zpět — server změnu odmítl (nejspíš pojistka proti zamčení).
      setProfiles(prev => prev.map(p => (p.id === profileId ? { ...p, role_id: previous } : p)))
      notify(result.error)
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px 60px' }}>
      <h1 style={{
        fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em',
        fontSize: '30px', color: 'var(--text-primary)', margin: '0 0 6px',
      }}>
        Role a práva
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 28px' }}>
        Kdo co smí. Omezení se vynucuje na serveru, skrytí v menu je jen doplněk.
      </p>

      {migrationMissing && (
        <div style={{
          marginBottom: '24px', padding: '14px 18px', borderRadius: '10px',
          backgroundColor: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.4)',
          color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.6,
        }}>
          <strong>Role zatím nejsou v databázi.</strong> Dokud se nespustí SQL migrace
          ze souboru <code>supabase-schema.sql</code>, má každý přihlášený plný přístup
          a přiřazovat role nejde.
        </div>
      )}

      {/* Založit nového člověka */}
      {!migrationMissing && (
        <form onSubmit={createNewUser} style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 140px auto', gap: '12px', alignItems: 'end',
          padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-card)',
          backgroundColor: 'var(--bg-card-alt)', marginBottom: '20px',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Jméno</label>
            <input
              type="text" required value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Tobiáš Kapek"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box',
                backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Uživatelské jméno</label>
            <input
              type="text" required value={newUsername} onChange={e => setNewUsername(e.target.value)}
              placeholder="tobiask"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box',
                backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Heslo</label>
            <input
              type="text" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="aspoň 6 znaků"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box',
                backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Role</label>
            <select
              value={newRoleId} onChange={e => setNewRoleId(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '13px',
                backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
              }}
            >
              <option value="">— bez role —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button
            type="submit" disabled={creating}
            style={{
              padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              backgroundColor: creating ? '#7a2e2e' : '#e05555', color: '#fff', border: 'none',
              cursor: creating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {creating ? 'Zakládám…' : '+ Založit'}
          </button>
        </form>
      )}

      {/* Lidé */}
      <div style={{
        borderRadius: '12px', overflow: 'hidden',
        border: '1px solid var(--border-card)', marginBottom: '36px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 150px 200px 190px', gap: '12px',
          padding: '10px 18px', backgroundColor: 'var(--bg-card-alt)',
          fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
        }}>
          <div>Člověk</div><div>Role</div><div>Změnit na</div><div>Akce</div>
        </div>

        {profiles.length === 0 && (
          <div style={{ padding: '20px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Zatím tu nikdo není.
          </div>
        )}

        {profiles.map(p => {
          const role = p.role_id ? rolesById.get(p.role_id) : undefined
          const isMe = user?.id === p.id
          return (
            <PersonRow
              key={p.id}
              profile={p}
              role={role}
              roles={roles}
              isMe={isMe}
              disabled={migrationMissing}
              saving={savingId === p.id}
              onChangeRole={roleId => changeRole(p.id, roleId)}
              onUpdated={updated => setProfiles(prev => prev.map(pr => (pr.id === updated.id ? updated : pr)))}
              onDeleted={() => setProfiles(prev => prev.filter(pr => pr.id !== p.id))}
            />
          )
        })}
      </div>

      {/* Co která role smí — editovatelné */}
      <h2 style={{
        fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em',
        fontSize: '20px', color: 'var(--text-primary)', margin: '0 0 6px',
      }}>
        Co která role smí
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 18px' }}>
        Zaškrtávej a ulož — projeví se hned. Kdo má přístup ke které konkrétní akci se nastavuje
        u dané akce, ne tady.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        {roles.map(role => (
          <RoleEditorCard
            key={role.id}
            role={role}
            onSaved={updated => setRoles(prev => prev.map(r => (r.id === updated.id ? updated : r)))}
          />
        ))}
      </div>

      <form onSubmit={addRole} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
          placeholder="Název nové role"
          style={{
            flex: 1, maxWidth: '260px', padding: '8px 10px', borderRadius: '8px', fontSize: '13px',
            backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
          }}
        />
        <button
          type="submit" disabled={creatingRole}
          style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
            cursor: creatingRole ? 'not-allowed' : 'pointer',
          }}
        >
          + Nová role
        </button>
      </form>
    </div>
  )
}
