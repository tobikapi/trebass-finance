'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { callAction } from '@/lib/call-action'
import { useDialog } from '@/lib/dialog-context'
import { useUser } from '@/lib/user-context'
import { PERMISSION_GROUPS, type Permissions, type Role } from '@/lib/permissions'
import Collapse from '@/components/Collapse'
import { brandOf } from '@/lib/orgs'

interface Access { role_id: string | null; is_owner: boolean }

interface ProfileRow {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  access: Record<string, Access>   // orgId → role a majitel v tom světě
}

interface World { id: string; name: string; isAdmin: boolean }

interface Props {
  initialProfiles: ProfileRow[]
  initialRoles: Role[]                  // role aktivní firmy (editor dole)
  worlds: World[]                       // světy, kde přihlášený spravuje lidi (aktivní první)
  rolesByOrg: Record<string, Role[]>
}

const ROLE_COLORS = ['#d15c49', '#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6']

function RoleEditorCard({ role, onSaved }: { role: Role; onSaved: (updated: Role) => void }) {
  const { notify } = useDialog()
  const { setViewAs } = useUser()
  const router = useRouter()
  const [name, setName] = useState(role.name)
  const [draft, setDraft] = useState<Permissions>(role.permissions || {})
  const [saving, setSaving] = useState(false)
  const isAdminRole = role.permissions?.admin === true
  const dirty = name.trim() !== role.name || JSON.stringify(draft) !== JSON.stringify(role.permissions || {})

  function toggle(key: keyof Permissions) {
    setDraft(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Zkratka nad canCreate/canEdit/canDelete — nemusí se ťukat po jednom.
  // canDeleteEvent (nevratné mazání celých akcí) se schválně nepřepíná s tím,
  // to je jinak závažné než smazat jeden výdaj.
  const isReader = !draft.canCreate && !draft.canEdit && !draft.canDelete
  function applyPreset(mode: 'reader' | 'editor') {
    setDraft(prev => ({ ...prev, canCreate: mode === 'editor', canEdit: mode === 'editor', canDelete: mode === 'editor' }))
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
        {!isAdminRole && (
          <button
            onClick={() => { setViewAs(role.id); router.push('/') }}
            title="Prohlédnout appku jako tahle role — vynucuje se i na serveru"
            style={{
              marginLeft: 'auto', padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
              backgroundColor: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border-card)', cursor: 'pointer',
            }}
          >
            👁 Zobrazit z pohledu
          </button>
        )}
        {dirty && (
          <button
            onClick={save} disabled={saving}
            style={{
              marginLeft: 'auto', padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
              backgroundColor: saving ? '#7a2e2e' : '#d15c49', color: '#fff', border: 'none',
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{
                  fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {group.label}
                </div>
                {group.label === 'Úpravy' && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" onClick={() => applyPreset('reader')} style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer',
                      border: '1px solid var(--border-card)',
                      backgroundColor: isReader ? 'var(--text-secondary)' : 'transparent',
                      color: isReader ? 'var(--bg-card-alt)' : 'var(--text-muted)',
                    }}>Čtenář</button>
                    <button type="button" onClick={() => applyPreset('editor')} style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer',
                      border: '1px solid var(--border-card)',
                      backgroundColor: !isReader ? '#d15c49' : 'transparent',
                      color: !isReader ? '#fff' : 'var(--text-muted)',
                    }}>Editor</button>
                  </div>
                )}
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

// Jeden člověk: účet (jméno, heslo) + přístup do každého světa, který
// přihlášený spravuje. Skládá se do karty, ať funguje i na telefonu.
function PersonRow({ profile, worlds, rolesByOrg, isMe, onUpdated, onDeleted }: {
  profile: ProfileRow; worlds: World[]; rolesByOrg: Record<string, Role[]>; isMe: boolean
  onUpdated: (updated: ProfileRow) => void
  onDeleted: () => void
}) {
  const { notify } = useDialog()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name || '')
  const [username, setUsername] = useState(profile.email?.replace(/@trebass\.cz$/, '') || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [busy, setBusy] = useState(false)
  const [savingOrg, setSavingOrg] = useState<string | null>(null)

  async function saveEdit() {
    setBusy(true)
    const result = await callAction<{ data?: Partial<ProfileRow>; error?: string }>('updateProfile', profile.id, name, username, phone)
    setBusy(false)
    if (result.error) { notify(result.error); return }
    if (result.data) onUpdated({ ...profile, ...result.data, access: profile.access })
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
    if (!confirm(`Smazat účet „${profile.name || username}" úplně (ze všech světů)? Nevratné.`)) return
    setBusy(true)
    const result = await callAction<{ data?: boolean; error?: string }>('deleteUser', profile.id)
    setBusy(false)
    if (result.error) { notify(result.error); return }
    onDeleted()
  }

  async function changeAccess(orgId: string, value: string) {
    const previous = profile.access
    const next = { ...profile.access }
    if (value === 'none') delete next[orgId]
    else next[orgId] = { role_id: value || null, is_owner: previous[orgId]?.is_owner ?? false }
    setSavingOrg(orgId)
    onUpdated({ ...profile, access: next })
    const result = await callAction<{ data?: unknown; error?: string }>('setOrgAccess', profile.id, orgId, value === 'none' ? 'none' : (value || null))
    setSavingOrg(null)
    if (result.error) { onUpdated({ ...profile, access: previous }); notify(result.error) }
  }

  async function toggleOwner(orgId: string) {
    const cur = profile.access[orgId]
    if (!cur) return
    const nextVal = !cur.is_owner
    onUpdated({ ...profile, access: { ...profile.access, [orgId]: { ...cur, is_owner: nextVal } } })
    const result = await callAction<{ data?: boolean; error?: string }>('setOwner', profile.id, nextVal, orgId)
    if (result.error) { onUpdated({ ...profile, access: { ...profile.access, [orgId]: cur } }); notify(result.error) }
  }

  const cellStyle = {
    width: '100%', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' as const,
    backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'center',
      padding: '14px 18px', borderTop: '1px solid var(--border-card)',
      opacity: busy ? 0.5 : 1,
    }}>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jméno" style={cellStyle} />
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="uživatelské jméno" style={cellStyle} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="telefon (nepovinné)" style={cellStyle} />
          </div>
        ) : (
          <>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {profile.name || '—'}
              {isMe && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>(ty)</span>}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {username || '—'}{profile.phone ? ` · ${profile.phone}` : ''}
            </div>
          </>
        )}
      </div>

      {/* Přístup do světů */}
      <div style={{ flex: '2 1 320px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {worlds.map(w => {
          const acc = profile.access[w.id]
          const b = brandOf(w.id)
          const roles = rolesByOrg[w.id] || []
          return (
            <div key={w.id} style={{
              flex: '1 1 150px', minWidth: 0, padding: '8px 10px', borderRadius: '8px',
              border: `1px solid ${acc ? b.accent + '66' : 'var(--border-card)'}`,
              backgroundColor: acc ? b.accentSoft : 'transparent',
              opacity: savingOrg === w.id ? 0.6 : 1,
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: acc ? b.accent : 'var(--text-muted)', marginBottom: '5px', letterSpacing: '0.04em' }}>
                {w.name}
              </div>
              <select
                value={acc ? (acc.role_id || '') : 'none'}
                disabled={savingOrg === w.id || busy}
                onChange={e => changeAccess(w.id, e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: '6px', fontSize: '13px',
                  backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
                }}
              >
                <option value="none">— bez přístupu —</option>
                <option value="">bez role (nic nevidí)</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {acc && (
                <label title="Majitel se dělí o výsledek ve vyrovnání (Firma → Vklady)" style={{
                  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', marginTop: '6px',
                  color: acc.is_owner ? 'var(--text-primary)' : 'var(--text-dim)',
                  cursor: w.isAdmin ? 'pointer' : 'default',
                }}>
                  <input type="checkbox" checked={acc.is_owner} disabled={!w.isAdmin || busy} onChange={() => toggleOwner(w.id)} />
                  majitel
                </label>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {editing ? (
          <>
            <button onClick={saveEdit} disabled={busy} style={actionBtnStyle('#d15c49')}>Uložit</button>
            <button onClick={() => setEditing(false)} disabled={busy} style={actionBtnStyle()}>Zpět</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} disabled={busy} style={actionBtnStyle()}>Upravit</button>
            <button onClick={resetPassword} disabled={busy} style={actionBtnStyle()}>Reset heslo</button>
            {!isMe && <button onClick={del} disabled={busy} style={actionBtnStyle('#d15c49')}>Smazat účet</button>}
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

export default function AdminClient({ initialProfiles, initialRoles, worlds, rolesByOrg }: Props) {
  const { notify } = useDialog()
  const { user, brand } = useUser()
  const [profiles, setProfiles] = useState<ProfileRow[]>(initialProfiles)
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [peopleOpen, setPeopleOpen] = useState(true)

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
  // Role nového člověka v každém světě: 'none' = bez přístupu. Výchozí:
  // v aktivním světě Crew Member, jinde bez přístupu.
  const defaultCrew = (orgId: string) => (rolesByOrg[orgId] || []).find(r => r.name === 'Crew Member' || r.name === 'Člen')?.id || ''
  const [newAccess, setNewAccess] = useState<Record<string, string>>(
    () => Object.fromEntries(worlds.map((w, i) => [w.id, i === 0 ? defaultCrew(w.id) : 'none']))
  )
  const [creating, setCreating] = useState(false)

  const migrationMissing = roles.length === 0

  async function createNewUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newName.trim() || !newUsername.trim() || !newPassword) return
    const access = Object.fromEntries(Object.entries(newAccess).filter(([, v]) => v !== 'none').map(([k, v]) => [k, v || null]))
    if (Object.keys(access).length === 0) { notify('Vyber aspoň jeden svět, do kterého bude mít přístup.'); return }

    setCreating(true)
    const result = await callAction<{ data?: ProfileRow; error?: string }>(
      'createUser', newName.trim(), newUsername.trim(), newPassword, access
    )
    setCreating(false)

    if (result.error) {
      notify(result.error)
      return
    }
    if (result.data) {
      setProfiles(prev => [...prev, result.data as ProfileRow].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs')))
    }
    notify(`Účet „${newUsername.trim()}" založen. Řekni mu jméno a heslo osobně.`)
    setNewName('')
    setNewUsername('')
    setNewPassword('')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box',
    backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px 60px' }}>
      <h1 style={{
        fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em',
        fontSize: '30px', color: 'var(--text-primary)', margin: '0 0 6px',
      }}>
        Lidé a role
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 28px' }}>
        Jeden účet, přístup do více světů — u každého člověka nastavíš roli v každém světě
        {worlds.length > 1 ? ` (${worlds.map(w => w.name).join(', ')})` : ''}. Omezení se vynucuje na serveru.
      </p>

      {migrationMissing && (
        <div style={{
          marginBottom: '24px', padding: '14px 18px', borderRadius: '10px',
          backgroundColor: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.4)',
          color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.6,
        }}>
          <strong>Role zatím nejsou v databázi.</strong> V tomhle světě nejsou žádné role — přidej je dole.
        </div>
      )}

      {/* Založit nového člověka */}
      <form onSubmit={createNewUser} style={{
        display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end',
        padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-card)',
        backgroundColor: 'var(--bg-card-alt)', marginBottom: '20px',
      }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Jméno</label>
          <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jan Novák" style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={labelStyle}>Uživatelské jméno</label>
          <input type="text" required value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="jannovak" style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={labelStyle}>Heslo</label>
          <input type="text" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="aspoň 6 znaků" style={inputStyle} />
        </div>
        {worlds.map(w => (
          <div key={w.id} style={{ flex: '1 1 140px' }}>
            <label style={{ ...labelStyle, color: brandOf(w.id).accent }}>Role v {w.name}</label>
            <select value={newAccess[w.id] ?? 'none'} onChange={e => setNewAccess(prev => ({ ...prev, [w.id]: e.target.value }))} style={inputStyle}>
              <option value="none">— bez přístupu —</option>
              <option value="">bez role (nic nevidí)</option>
              {(rolesByOrg[w.id] || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        ))}
        <button type="submit" disabled={creating} style={{
          padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          backgroundColor: creating ? '#7a2e2e' : '#d15c49', color: '#fff', border: 'none',
          cursor: creating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        }}>
          {creating ? 'Zakládám…' : '+ Založit'}
        </button>
      </form>

      {/* Lidé */}
      <div style={{
        borderRadius: '12px', overflow: 'hidden',
        border: '1px solid var(--border-card)', marginBottom: '36px',
      }}>
        <button
          onClick={() => setPeopleOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 18px', backgroundColor: 'var(--bg-card-alt)', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
          }}
        >
          <span>Lidé ({profiles.length})</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', transform: peopleOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </button>

        <Collapse open={peopleOpen}>
          {profiles.length === 0 && (
            <div style={{ padding: '20px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Zatím tu nikdo není.
            </div>
          )}
          {profiles.map(p => (
            <PersonRow
              key={p.id}
              profile={p}
              worlds={worlds}
              rolesByOrg={rolesByOrg}
              isMe={user?.id === p.id}
              onUpdated={updated => setProfiles(prev => prev.map(pr => (pr.id === updated.id ? updated : pr)))}
              onDeleted={() => setProfiles(prev => prev.filter(pr => pr.id !== p.id))}
            />
          ))}
        </Collapse>
      </div>

      {/* Co která role smí — editovatelné */}
      <h2 style={{
        fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em',
        fontSize: '20px', color: 'var(--text-primary)', margin: '0 0 6px',
      }}>
        Co která role smí · {brand.name}
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 18px' }}>
        Role ve světě {brand.name} (role jiného světa upravíš po přepnutí v menu). Zaškrtávej a ulož —
        projeví se hned. Kdo má přístup ke které konkrétní akci se nastavuje u dané akce, ne tady.
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
