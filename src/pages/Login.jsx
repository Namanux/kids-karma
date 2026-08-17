import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const AVATAR_COLORS = {
  admin: '#f5c518',
  'co-admin': '#a855f7',
  kid: null, // per-profile
}

export default function Login() {
  const { profiles, loginWithPin, loginWithPassword } = useAuth()
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const profile = profiles.find(p => p.id === selected)

  function handleProfileTap(p) {
    setSelected(p.id)
    setPin('')
    setPassword('')
    setError('')
  }

  async function handlePinDigit(digit) {
    const next = pin + digit
    setPin(next)
    setError('')

    if (next.length === 4) {
      setLoading(true)
      const result = await loginWithPin(selected, next)
      setLoading(false)
      if (result.error) {
        setError(result.error)
        setTimeout(() => setPin(''), 600)
      }
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const result = await loginWithPassword(selected, password)
    setLoading(false)
    if (result.error) setError(result.error)
  }

  function handleBack() {
    setSelected(null)
    setPin('')
    setPassword('')
    setError('')
  }

  const kids = profiles.filter(p => p.role === 'kid')
  const parents = profiles.filter(p => p.role === 'admin' || p.role === 'co-admin')

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1a1a40 0%, #0f0f1a 70%)',
      padding: 24,
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>🪙</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#f5c518', letterSpacing: -1 }}>
          Kids Karma
        </h1>
        <p style={{ color: '#94a3b8', marginTop: 4, fontSize: 15 }}>
          Who's there?
        </p>
      </div>

      {!selected ? (
        <div style={{ width: '100%', maxWidth: 480 }}>
          {/* Kids */}
          {kids.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Kids</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {kids.map(p => (
                  <ProfileCard key={p.id} profile={p} onTap={() => handleProfileTap(p)} />
                ))}
              </div>
            </div>
          )}

          {/* Parents */}
          {parents.length > 0 && (
            <div>
              <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Parents</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {parents.map(p => (
                  <ProfileCard key={p.id} profile={p} onTap={() => handleProfileTap(p)} />
                ))}
              </div>
            </div>
          )}

          {profiles.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
              <p style={{ fontWeight: 600 }}>No profiles yet</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>Complete Supabase setup and seed your profiles.</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          {/* Back */}
          <button onClick={handleBack} style={{
            color: '#94a3b8', fontSize: 14, marginBottom: 24, display: 'flex',
            alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer',
          }}>
            ← Back
          </button>

          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: profile?.avatar_color || '#4f8ef7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 12px',
          }}>
            {profile?.avatar_emoji || '😊'}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{profile?.name}</h2>

          {profile?.role === 'kid' ? (
            /* PIN entry */
            <div>
              <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>Enter your PIN</p>

              {/* PIN dots */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
                ))}
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 16 }}>{error}</p>}

              {/* Numpad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
                  <button key={i}
                    onClick={() => {
                      if (d === '⌫') { setPin(p => p.slice(0,-1)); setError('') }
                      else if (d !== '' && pin.length < 4) handlePinDigit(String(d))
                    }}
                    disabled={loading || (d === '' )}
                    style={{
                      padding: '20px', fontSize: 22, fontWeight: 600,
                      background: d === '' ? 'transparent' : 'rgba(255,255,255,0.06)',
                      border: '1px solid',
                      borderColor: d === '' ? 'transparent' : 'rgba(255,255,255,0.08)',
                      borderRadius: 12, color: '#f1f5f9',
                      cursor: d === '' ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Password entry */
            <form onSubmit={handlePasswordSubmit} style={{ marginTop: 24 }}>
              <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>Enter your password</p>
              <input
                type="password"
                className="input-field"
                placeholder="Password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                autoFocus
                style={{ marginBottom: 12 }}
              />
              {error && <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>}
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function ProfileCard({ profile, onTap }) {
  return (
    <button onClick={onTap} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px', borderRadius: 16,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      gap: 12, cursor: 'pointer', transition: 'all 0.15s',
      width: '100%',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
    >
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: profile.avatar_color || '#4f8ef7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
      }}>
        {profile.avatar_emoji || '😊'}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{profile.name}</div>
        {profile.role === 'kid' && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            🪙 {profile.coin_balance || 0} coins
          </div>
        )}
      </div>
    </button>
  )
}
