import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)      // currently logged-in profile
  const [profiles, setProfiles] = useState([])       // all family profiles
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfiles()
    // Persist session across reload
    const stored = localStorage.getItem('kk_profile')
    if (stored) {
      try { setProfile(JSON.parse(stored)) } catch {}
    }
    setLoading(false)
  }, [])

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('role')
    if (data) setProfiles(data)
  }

  async function loginWithPin(profileId, pin) {
    const p = profiles.find(x => x.id === profileId)
    if (!p) return { error: 'Profile not found' }
    if (p.pin !== pin) return { error: 'Wrong PIN' }
    const freshProfile = await refreshProfile(profileId)
    setProfile(freshProfile)
    localStorage.setItem('kk_profile', JSON.stringify(freshProfile))
    return { success: true }
  }

  async function loginWithPassword(profileId, password) {
    // For parents, we use Supabase Auth email/password
    // Profile email is stored in the profile record
    const p = profiles.find(x => x.id === profileId)
    if (!p) return { error: 'Profile not found' }
    const { error } = await supabase.auth.signInWithPassword({
      email: p.email,
      password,
    })
    if (error) return { error: error.message }
    const freshProfile = await refreshProfile(profileId)
    setProfile(freshProfile)
    localStorage.setItem('kk_profile', JSON.stringify(freshProfile))
    return { success: true }
  }

  async function refreshProfile(profileId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()
    return data
  }

  async function refreshCurrentProfile() {
    if (!profile) return
    const fresh = await refreshProfile(profile.id)
    if (fresh) {
      setProfile(fresh)
      localStorage.setItem('kk_profile', JSON.stringify(fresh))
    }
  }

  function logout() {
    setProfile(null)
    localStorage.removeItem('kk_profile')
    supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      profile, profiles, loading,
      loginWithPin, loginWithPassword,
      logout, loadProfiles, refreshCurrentProfile,
      isParent: profile?.role === 'admin' || profile?.role === 'co-admin',
      isKid: profile?.role === 'kid',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
