import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import KidDashboard from './pages/KidDashboard'
import ParentDashboard from './pages/ParentDashboard'

export default function App() {
  const { profile, loading } = useAuth()

  if (loading) return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, background: 'var(--bg-primary)',
    }}>
      <div style={{ fontSize: 56 }}>🪙</div>
      <div style={{ color: '#f5c518', fontWeight: 700, fontSize: 18 }}>Kids Karma</div>
    </div>
  )

  if (!profile) return <Login />

  if (profile.role === 'kid') return <KidDashboard />

  return <ParentDashboard />
}
