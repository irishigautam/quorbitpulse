'use client'

import { useState, useEffect } from 'react'

type Role = 'admin' | 'recruiter' | 'viewer'

interface Member {
  id: string
  user_id: string
  role: Role
  accepted_at: string | null
  invited_email: string | null
  user?: { email: string; raw_user_meta_data?: { full_name?: string } }
}

interface Invite {
  id: string
  email: string
  role: Role
  created_at: string
  expires_at: string
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  recruiter: 'Recruiter',
  viewer: 'Viewer',
}

const ROLE_COLORS: Record<Role, { bg: string; color: string }> = {
  admin: { bg: '#EEF2FF', color: '#4338CA' },
  recruiter: { bg: '#F0FDF4', color: '#166534' },
  viewer: { bg: '#F3F4F6', color: '#6B7280' },
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [myUserId, setMyUserId] = useState<string>('')
  const [myRole, setMyRole] = useState<Role>('viewer')
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'recruiter' | 'viewer'>('recruiter')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/team/members').then(r => r.json()),
      fetch('/api/company/me').then(r => r.json()),
    ]).then(([teamData, meData]) => {
      setMembers(teamData.members ?? [])
      setInvites(teamData.invites ?? [])
      setMyUserId(meData.company?.user_id ?? '')
      // Determine my role
      const me = (teamData.members ?? []).find((m: Member) => m.user_id === meData.userId)
      setMyRole(me?.role ?? 'viewer')
      setLoading(false)
    })
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const isAdmin = myRole === 'admin'

  async function handleInvite() {
    if (!inviteEmail) return
    setSending(true)
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    const data = await res.json()
    if (data.ok) {
      showToast(`✓ Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      // Refresh
      fetch('/api/team/members').then(r => r.json()).then(d => {
        setMembers(d.members ?? [])
        setInvites(d.invites ?? [])
      })
    } else {
      showToast(`⚠ ${data.error ?? 'Failed to send invite'}`)
    }
    setSending(false)
  }

  async function handleRoleChange(userId: string, role: Role) {
    await fetch('/api/team/members/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m))
    showToast('Role updated.')
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remove this member from the company?')) return
    await fetch('/api/team/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    setMembers(prev => prev.filter(m => m.user_id !== userId))
    showToast('Member removed.')
  }

  async function handleRevokeInvite(inviteId: string) {
    await fetch('/api/team/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId }),
    })
    setInvites(prev => prev.filter(i => i.id !== inviteId))
    showToast('Invite revoked.')
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>Team</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Manage who has access to your company's Pulse account.
        </p>
      </div>

      {toast && (
        <div style={{
          background: toast.startsWith('⚠') ? '#FEE2E2' : '#DCFCE7',
          color: toast.startsWith('⚠') ? '#991B1B' : '#166534',
          padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 500,
        }}>
          {toast}
        </div>
      )}

      {/* Invite form — admin only */}
      {isAdmin && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>Invite a team member</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              style={{ flex: 1, minWidth: 220, padding: '0.6rem 0.875rem', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.9rem' }}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'recruiter' | 'viewer')}
              style={{ padding: '0.6rem 0.875rem', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', background: '#fff' }}
            >
              <option value="recruiter">Recruiter</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={sending || !inviteEmail}
              style={{ padding: '0.6rem 1.25rem', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', opacity: sending ? 0.7 : 1 }}
            >
              {sending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.75rem' }}>
            <strong>Recruiter</strong> — can post jobs, view candidates, manage pipeline.{' '}
            <strong>Viewer</strong> — read-only access to jobs and candidates.
          </p>
        </div>
      )}

      {/* Members list */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: '1.25rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem' }}>
          Members ({members.length})
        </div>
        {loading ? (
          <div style={{ padding: '1.5rem', color: 'var(--muted)', textAlign: 'center' }}>Loading…</div>
        ) : members.map((member, i) => {
          const email = member.user?.email ?? member.invited_email ?? '—'
          const name = member.user?.raw_user_meta_data?.full_name
          const isMe = member.user_id === myUserId
          const roleStyle = ROLE_COLORS[member.role]

          return (
            <div key={member.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.875rem',
              padding: '0.875rem 1.25rem',
              borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none',
              flexWrap: 'wrap',
            }}>
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#EEF2FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, color: '#4338CA', fontSize: '0.9rem', flexShrink: 0,
              }}>
                {(name ?? email).charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                  {name ?? email}
                  {isMe && <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '0.4rem' }}>(you)</span>}
                </div>
                {name && <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{email}</div>}
              </div>

              {/* Role badge / selector */}
              {isAdmin && !isMe ? (
                <select
                  value={member.role}
                  onChange={e => handleRoleChange(member.user_id, e.target.value as Role)}
                  style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--border)', background: roleStyle.bg, color: roleStyle.color, cursor: 'pointer' }}
                >
                  <option value="admin">Admin</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '4px 12px', borderRadius: 999, background: roleStyle.bg, color: roleStyle.color }}>
                  {ROLE_LABELS[member.role]}
                </span>
              )}

              {isAdmin && !isMe && (
                <button
                  onClick={() => handleRemove(member.user_id)}
                  style={{ fontSize: '0.78rem', color: '#DC2626', background: 'none', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem' }}>
            Pending Invites ({invites.length})
          </div>
          {invites.map((invite, i) => (
            <div key={invite.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.875rem',
              padding: '0.875rem 1.25rem',
              borderBottom: i < invites.length - 1 ? '1px solid var(--border)' : 'none',
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{invite.email}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Expires {new Date(invite.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '4px 12px', borderRadius: 999, background: ROLE_COLORS[invite.role].bg, color: ROLE_COLORS[invite.role].color }}>
                {ROLE_LABELS[invite.role]}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#D97706', background: '#FEF3C7', padding: '4px 10px', borderRadius: 999, fontWeight: 500 }}>
                Pending
              </span>
              {isAdmin && (
                <button
                  onClick={() => handleRevokeInvite(invite.id)}
                  style={{ fontSize: '0.78rem', color: '#DC2626', background: 'none', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
