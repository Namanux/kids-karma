import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  calculateCoins, getTaskStatus, secondsUntilChange,
  formatCountdown, formatTime, formatCoins, coinsToLevel
} from '../lib/points'

// ─── Local date helper (Brisbane-safe, avoids UTC midnight bug) ───────────────
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Inject CSS keyframes once ────────────────────────────────────────────────
if (!document.getElementById('kk-styles')) {
  const s = document.createElement('style')
  s.id = 'kk-styles'
  s.textContent = `
    @keyframes celebBounce {
      0%,100% { transform: scale(1); }
      30%      { transform: scale(1.18); }
      60%      { transform: scale(0.95); }
    }
    @keyframes celebFade {
      0%   { opacity:0; transform:translateY(20px) scale(0.9); }
      15%  { opacity:1; transform:translateY(0)   scale(1); }
      80%  { opacity:1; }
      100% { opacity:0; transform:translateY(-10px); }
    }
    @keyframes coinSpin {
      0%   { transform: rotateY(0deg); }
      100% { transform: rotateY(360deg); }
    }
    @keyframes timerPulse {
      0%,100% { opacity:1; }
      50%      { opacity:0.6; }
    }
    @keyframes confettiDrop {
      0%   { transform: translateY(0) rotate(0deg); opacity:1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity:0; }
    }
    .kk-timer-pulse { animation: timerPulse 1s infinite; }
  `
  document.head.appendChild(s)
}

// ─── GoldCoin component (cross-platform, replaces 🪙 emoji) ──────────────────
function GoldCoin({ size = 16 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 38% 35%, #ffe566, #f5c518 55%, #b8860b)',
      border: `${Math.max(1, size * 0.08)}px solid #c9a010`,
      boxShadow: `0 ${size * 0.05}px ${size * 0.15}px rgba(245,197,24,0.4)`,
      flexShrink: 0, verticalAlign: 'middle',
    }} />
  )
}

// ─── Web Audio API ────────────────────────────────────────────────────────────
let _audioCtx = null
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}

function playNote(freq, type, startTime, duration, gainVal = 0.3) {
  const ctx = getAudioCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)
  gain.gain.setValueAtTime(gainVal, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

function playSound(type) {
  try {
    const ctx = getAudioCtx()
    const t = ctx.currentTime
    if (type === 'coin') {
      // Bright ding — major third
      playNote(880, 'sine', t, 0.15, 0.3)
      playNote(1100, 'sine', t + 0.05, 0.12, 0.2)
      playNote(1320, 'sine', t + 0.1, 0.2, 0.25)
    } else if (type === 'milestone') {
      // Ascending fanfare
      [523, 659, 784, 1047].forEach((f, i) => playNote(f, 'triangle', t + i * 0.12, 0.25, 0.35))
      playNote(1047, 'sine', t + 0.55, 0.5, 0.3)
    } else if (type === 'levelup') {
      // Epic level-up flourish
      [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => {
        playNote(f, 'triangle', t + i * 0.08, 0.18, 0.4)
      })
      playNote(1047, 'sine', t + 0.7, 0.8, 0.4)
      playNote(1319, 'sine', t + 0.9, 0.6, 0.35)
    } else if (type === 'nudge') {
      // Gentle two-tone nudge
      playNote(660, 'sine', t, 0.2, 0.15)
      playNote(440, 'sine', t + 0.25, 0.25, 0.12)
    }
  } catch (e) { /* audio not available */ }
}

// ─── Web Speech API ───────────────────────────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 0.95
  utt.pitch = 1.1
  utt.volume = 1
  // Prefer a local voice
  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find(v => v.lang.startsWith('en') && v.localService)
  if (preferred) utt.voice = preferred
  window.speechSynthesis.speak(utt)
}

// ─── Confetti Canvas ──────────────────────────────────────────────────────────
function ConfettiCanvas({ active }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const COLORS = ['#f5c518','#22c55e','#4f8ef7','#a855f7','#f97316','#ef4444','#fff']
    const particles = []

    // Two bursts from bottom corners
    for (let burst = 0; burst < 2; burst++) {
      const ox = burst === 0 ? canvas.width * 0.2 : canvas.width * 0.8
      for (let i = 0; i < 60; i++) {
        const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.9
        const speed = 6 + Math.random() * 8
        particles.push({
          x: ox, y: canvas.height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 5 + Math.random() * 6,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
          life: 1,
          decay: 0.012 + Math.random() * 0.008,
        })
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      for (const p of particles) {
        p.x += p.vx; p.vy += 0.25; p.y += p.vy
        p.rotation += p.rotSpeed; p.life -= p.decay
        if (p.life <= 0) continue
        alive = true
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6)
        ctx.restore()
      }
      if (alive) rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(rafRef.current); ctx.clearRect(0, 0, canvas.width, canvas.height) }
  }, [active])

  if (!active) return null
  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      pointerEvents: 'none', width: '100%', height: '100%',
    }} />
  )
}

// ─── Celebration Overlay ──────────────────────────────────────────────────────
const MILESTONES = [
  { emoji: '🎉', msg: 'Amazing!',       color: '#f5c518' },
  { emoji: '🔥', msg: 'On Fire!',       color: '#f97316' },
  { emoji: '⚡', msg: 'Supercharged!',  color: '#4f8ef7' },
  { emoji: '🚀', msg: 'Blast Off!',     color: '#a855f7' },
  { emoji: '💎', msg: 'Legendary!',     color: '#22c55e' },
  { emoji: '🏆', msg: 'Champion!',      color: '#f5c518' },
  { emoji: '👑', msg: 'Royalty!',       color: '#ef4444' },
  { emoji: '⭐', msg: 'Superstar!',     color: '#4f8ef7' },
]

function CelebrationOverlay({ celebration, onDone }) {
  useEffect(() => {
    if (!celebration) return
    const t = setTimeout(onDone, 5000)
    return () => clearTimeout(t)
  }, [celebration])

  if (!celebration) return null

  const isLevelUp = celebration.type === 'levelup'
  const milestone = isLevelUp ? null : MILESTONES[(Math.floor((celebration.coins || 0) / 100) - 1) % MILESTONES.length]
  const accent = isLevelUp ? '#f5c518' : (milestone?.color || '#f5c518')

  return (
    <div
      onClick={onDone}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        animation: 'celebFade 5s ease-out forwards',
      }}
    >
      <div style={{
        textAlign: 'center', padding: '40px 48px',
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        border: `2px solid ${accent}`,
        borderRadius: 24,
        boxShadow: `0 0 60px ${accent}44`,
        animation: 'celebBounce 0.5s ease',
        maxWidth: 320,
      }}>
        <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 12 }}>
          {isLevelUp ? celebration.emoji : milestone?.emoji}
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: accent, marginBottom: 8 }}>
          {isLevelUp ? `Level Up!` : `${celebration.coins} Coins!`}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
          {isLevelUp ? celebration.label : milestone?.msg}
        </div>
        {isLevelUp && (
          <div style={{ fontSize: 16, color: '#94a3b8', marginTop: 8 }}>
            You're now a <span style={{ color: accent, fontWeight: 700 }}>{celebration.label}</span>!
          </div>
        )}
        {!isLevelUp && (
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>
            Keep going — you're crushing it!
          </div>
        )}
        <div style={{ fontSize: 12, color: '#475569', marginTop: 20 }}>Tap to continue</div>
      </div>
    </div>
  )
}

// ─── Focus timer helpers ──────────────────────────────────────────────────────
function formatDuration(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Main KidDashboard ────────────────────────────────────────────────────────
export default function KidDashboard() {
  const { profile, logout, refreshCurrentProfile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState([])
  const [messages, setMessages] = useState([])
  const [coinPops, setCoinPops] = useState([])
  const [now, setNow] = useState(new Date())
  const [celebration, setCelebration] = useState(null)

  const todayStr = localDateStr(now)
  const [viewDate, setViewDate] = useState(todayStr)
  const viewDateRef = useRef(viewDate)
  useEffect(() => { viewDateRef.current = viewDate }, [viewDate])
  const isToday = viewDate === todayStr

  // Inactivity tracking (for voice reminder)
  const lastInteractionRef = useRef(Date.now())
  const prevStatusMapRef = useRef({})   // taskId → last-seen status (for transition voice)

  // Unlock Web Audio on first touch (required on iOS)
  useEffect(() => {
    const unlock = () => { getAudioCtx(); document.removeEventListener('touchstart', unlock) }
    document.addEventListener('touchstart', unlock, { passive: true })
    return () => document.removeEventListener('touchstart', unlock)
  }, [])

  // Clock — also rolls viewDate forward at midnight
  useEffect(() => {
    const t = setInterval(() => {
      const newNow = new Date()
      setNow(newNow)
      if (viewDateRef.current === localDateStr(new Date(newNow - 1000))) {
        setViewDate(localDateStr(newNow))
      }
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Track user interaction for inactivity detection
  function touchInteraction() {
    lastInteractionRef.current = Date.now()
  }
  useEffect(() => {
    window.addEventListener('touchstart', touchInteraction, { passive: true })
    window.addEventListener('click', touchInteraction, { passive: true })
    return () => {
      window.removeEventListener('touchstart', touchInteraction)
      window.removeEventListener('click', touchInteraction)
    }
  }, [])

  // Voice reminder check — every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!profile || !isToday) return
      const completedIds = new Set(completions.map(c => c.task_id))
      const pendingActiveTasks = tasks.filter(t =>
        !completedIds.has(t.id) &&
        ['active', 'grace'].includes(getTaskStatus(t))
      )
      const inactiveSecs = (Date.now() - lastInteractionRef.current) / 1000
      if (pendingActiveTasks.length > 0 && inactiveSecs > 12 * 60) {
        const t = pendingActiveTasks[0]
        speak(`${profile.name}, don't forget your task: ${t.name}!`)
        lastInteractionRef.current = Date.now() // reset so it doesn't spam
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [profile, tasks, completions, isToday])

  // Detect task status transitions → speak on upcoming→active or active→grace
  useEffect(() => {
    if (!profile || !isToday) return
    const completedIds = new Set(completions.map(c => c.task_id))
    for (const task of tasks) {
      if (completedIds.has(task.id)) continue
      const status = getTaskStatus(task, false, viewDateRef.current)
      const prev = prevStatusMapRef.current[task.id]
      if (prev && prev !== status) {
        if (prev === 'upcoming' && status === 'active') {
          speak(`${profile.name}, time for ${task.name}!`)
        } else if (prev === 'active' && status === 'grace') {
          speak(`${profile.name}, ${task.name} is running late — please do it now!`)
        }
      }
      prevStatusMapRef.current[task.id] = status
    }
  }, [now, tasks, completions, profile, isToday])

  // Load data whenever profile or viewDate changes
  useEffect(() => {
    if (!profile) return
    loadTasks()
    loadMessages()
    const ch = supabase.channel('kid-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, loadTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `to_id=eq.${profile.id}` }, loadMessages)
      .subscribe()
    return () => ch.unsubscribe()
  }, [profile?.id, viewDate])

  async function loadTasks() {
    if (!profile) return
    const vd = viewDateRef.current
    const [y, m, d] = vd.split('-').map(Number)
    const dayOfWeek = new Date(y, m - 1, d, 12, 0, 0).getDay()

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', profile.id)
      .eq('is_active', true)
      .contains('days_of_week', [dayOfWeek])
      .order('start_time')

    const { data: compData } = await supabase
      .from('task_completions')
      .select('*')
      .eq('kid_id', profile.id)
      .eq('scheduled_date', vd)

    setTasks(taskData || [])
    setCompletions(compData || [])
    refreshCurrentProfile()
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*, from:from_id(name, avatar_emoji, avatar_color)')
      .or(`to_id.eq.${profile.id},to_id.is.null`)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5)
    setMessages(data || [])
  }

  async function markMessageRead(id) {
    await supabase.from('messages').update({ is_read: true }).eq('id', id)
    setMessages(m => m.filter(x => x.id !== id))
  }

  async function completeTask(task, timeSpentSecs = null) {
    const existing = completions.find(c => c.task_id === task.id)
    if (existing) return

    // Calculate coins — proportional for focus tasks
    let coinsEarned = calculateCoins(task)
    if (timeSpentSecs !== null && task.target_duration > 0) {
      const ratio = Math.max(0.5, timeSpentSecs / task.target_duration)
      coinsEarned = Math.round(coinsEarned * Math.min(1, ratio))
    }

    const needsApproval = task.requires_approval === true

    if (needsApproval) {
      // ── Needs parent approval: hold coins until parent approves ──
      await supabase.from('task_completions').insert({
        task_id: task.id,
        kid_id: profile.id,
        scheduled_date: viewDateRef.current,
        coins_earned: coinsEarned,
        status: 'pending_approval',
      })
      // Gentle sound + pop with pending indicator (no confetti — coins not landed yet)
      playSound('coin')
      popCoins(task.id, coinsEarned, true) // true = pending style
    } else {
      // ── Auto-approved: give coins immediately, full celebration ──
      const { data: freshKid } = await supabase
        .from('profiles').select('coin_balance').eq('id', profile.id).single()
      const balanceBefore = freshKid?.coin_balance || 0

      const { data: comp } = await supabase.from('task_completions').insert({
        task_id: task.id,
        kid_id: profile.id,
        scheduled_date: viewDateRef.current,
        coins_earned: coinsEarned,
        status: 'auto_approved',
      }).select().single()

      await supabase.from('coin_transactions').insert({
        kid_id: profile.id,
        amount: coinsEarned,
        reason: `Completed: ${task.name}`,
        transaction_type: 'task_reward',
        reference_id: comp?.id,
      })
      await supabase.from('profiles')
        .update({ coin_balance: balanceBefore + coinsEarned })
        .eq('id', profile.id)

      const balanceAfter = balanceBefore + coinsEarned
      playSound('coin')
      popCoins(task.id, coinsEarned, false)

      // Detect level-up
      const levelBefore = coinsToLevel(balanceBefore)
      const levelAfter = coinsToLevel(balanceAfter)
      if (levelBefore.label !== levelAfter.label) {
        setTimeout(() => {
          playSound('levelup')
          setCelebration({ type: 'levelup', label: levelAfter.label, emoji: levelAfter.emoji })
        }, 700)
      } else {
        // Detect milestone (every 100 coins)
        const mBefore = Math.floor(balanceBefore / 100)
        const mAfter = Math.floor(balanceAfter / 100)
        if (mAfter > mBefore) {
          setTimeout(() => {
            playSound('milestone')
            setCelebration({ type: 'milestone', coins: mAfter * 100 })
          }, 700)
        }
      }
    }

    await loadTasks()
    await refreshCurrentProfile()
  }

  function popCoins(taskId, amount, pending = false) {
    const id = Date.now()
    setCoinPops(p => [...p, { id, taskId, amount, pending }])
    setTimeout(() => setCoinPops(p => p.filter(x => x.id !== id)), 1400)
  }

  function shiftDate(days) {
    const [y, m, d] = viewDate.split('-').map(Number)
    const next = new Date(y, m - 1, d + days, 12, 0, 0)
    setViewDate(localDateStr(next))
  }

  function formatViewDate() {
    const [y, m, d] = viewDate.split('-').map(Number)
    const date = new Date(y, m - 1, d, 12, 0, 0)
    const label = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
    return isToday ? `${label} · Today` : label
  }

  // Computed stats
  const level = coinsToLevel(profile?.coin_balance || 0)
  const completedIds = new Set(completions.map(c => c.task_id))
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => completedIds.has(t.id)).length
  const pendingTasks = tasks.filter(t => !completedIds.has(t.id))
  const todayCoinsEarned = completions.reduce((s, c) => s + (c.coins_earned || 0), 0)
  const todayPossible = tasks.reduce((s, t) => s + (t.full_coins || 0), 0)
  const allDone = doneTasks === totalTasks && totalTasks > 0
  const levelProgress = level.next
    ? Math.min(100, ((profile?.coin_balance - level.min) / (level.next.min - level.min)) * 100)
    : 100

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}
      onClick={touchInteraction}
    >
      {/* ── Confetti ── */}
      <ConfettiCanvas active={!!celebration} />
      <CelebrationOverlay celebration={celebration} onDone={() => setCelebration(null)} />

      {/* ── Compact header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        padding: '10px 14px 0',
      }}>
        {/* Date row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); shiftDate(-1) }}
            style={{
              width: 26, height: 26, borderRadius: 7,
              border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)',
              color: '#94a3b8', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >‹</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
            {formatViewDate()}
          </span>
          <button
            onClick={e => { e.stopPropagation(); shiftDate(1) }}
            style={{
              width: 26, height: 26, borderRadius: 7,
              border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)',
              color: '#94a3b8', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >›</button>
          <button
            onClick={logout}
            style={{
              fontSize: 11, color: '#475569', padding: '4px 8px',
              background: 'rgba(255,255,255,0.05)', borderRadius: 6,
              border: '1px solid var(--border)', marginLeft: 4,
            }}
          >Switch</button>
        </div>

        {/* Kid row — avatar · name | level · total | day earned/possible | ✅ done/total */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
          {/* Avatar */}
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: `${profile?.avatar_color || '#4f8ef7'}33`,
            border: `2px solid ${profile?.avatar_color || '#4f8ef7'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            {profile?.avatar_emoji || '🧒'}
          </div>

          {/* Name */}
          <span style={{ fontWeight: 800, fontSize: 17, flexShrink: 0 }}>
            {profile?.name}
          </span>

          <span style={{ color: '#475569', fontSize: 14 }}>|</span>

          {/* Level + total coins */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 15 }}>{level.emoji}</span>
            <GoldCoin size={13} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#f5c518' }}>
              {formatCoins(profile?.coin_balance || 0)}
            </span>
          </div>

          <span style={{ color: '#475569', fontSize: 14 }}>|</span>

          {/* Today earned/possible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <GoldCoin size={11} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f5c518' }}>{todayCoinsEarned}</span>
            <span style={{ fontSize: 12, color: '#475569' }}>/{todayPossible}</span>
          </div>

          <span style={{ color: '#475569', fontSize: 14 }}>|</span>

          {/* Tasks done/total */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <span style={{ fontSize: 13 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>{doneTasks}</span>
            <span style={{ fontSize: 12, color: '#475569' }}>/{totalTasks}</span>
          </div>
        </div>

        {/* 3px level progress bar */}
        <div style={{
          height: 3, background: 'rgba(255,255,255,0.06)',
          borderRadius: 0, overflow: 'hidden',
          marginLeft: -14, marginRight: -14,
        }}>
          <div style={{
            height: '100%',
            width: `${levelProgress}%`,
            background: `linear-gradient(90deg, ${level.color}, ${level.next?.color || level.color})`,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Messages banner */}
      {messages.length > 0 && (
        <div style={{ padding: '8px 14px 0', flexShrink: 0 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(168,85,247,0.1)',
              border: '1px solid rgba(168,85,247,0.3)',
              marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a855f7' }}>
                  {msg.from?.avatar_emoji} {msg.from?.name}:
                </span>
                <p style={{ fontSize: 13, marginTop: 2 }}>{msg.content}</p>
              </div>
              <button onClick={() => markMessageRead(msg.id)} style={{ fontSize: 16, padding: 4, flexShrink: 0 }}>✓</button>
            </div>
          ))}
        </div>
      )}

      {/* Past/future notice */}
      {!isToday && (
        <div style={{
          margin: '6px 14px 0', padding: '7px 12px', borderRadius: 8,
          background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.2)',
          fontSize: 12, color: '#4f8ef7', textAlign: 'center', flexShrink: 0,
        }}>
          📅 {viewDate < todayStr ? 'Past' : 'Future'} tasks — read only ·{' '}
          <span onClick={() => setViewDate(todayStr)} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
            Back to today
          </span>
        </div>
      )}

      {/* Task list */}
      <div className="scroll-y" style={{ flex: 1, padding: '10px 14px', paddingBottom: 0 }}>

        {/* All done screen */}
        {allDone && isToday ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', textAlign: 'center', padding: 32,
          }}>
            <div style={{ fontSize: 72, marginBottom: 16, animation: 'celebBounce 1s ease infinite' }}>🏆</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#f5c518', marginBottom: 8 }}>
              All done for today!
            </div>
            <div style={{ fontSize: 15, color: '#94a3b8', marginBottom: 16 }}>
              You earned <span style={{ color: '#f5c518', fontWeight: 700 }}>{todayCoinsEarned}</span> coins today.
            </div>
            <div style={{ fontSize: 13, color: '#475569' }}>Tasks sent to parent for approval.</div>
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <p style={{ fontWeight: 600, fontSize: 18 }}>No tasks{isToday ? ' today' : ' this day'}!</p>
            <p style={{ marginTop: 8, fontSize: 14 }}>{isToday ? 'Enjoy your free time.' : 'Nothing scheduled.'}</p>
          </div>
        ) : (
          <>
            {/* "X completed" banner — only when some done, some pending */}
            {doneTasks > 0 && pendingTasks.length > 0 && (
              <div style={{
                padding: '8px 14px', borderRadius: 10, marginBottom: 10,
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                fontSize: 13, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>✅ {doneTasks} task{doneTasks !== 1 ? 's' : ''} completed — sent to parent</span>
              </div>
            )}

            {/* Pending tasks only */}
            {pendingTasks.length === 0 && !allDone ? null : pendingTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                kidId={profile.id}
                viewDate={viewDateRef.current}
                coinPop={coinPops.find(p => p.taskId === task.id)}
                onComplete={(timeSpentSecs) => completeTask(task, timeSpentSecs)}
                now={now}
                isToday={isToday}
              />
            ))}
          </>
        )}

        <div style={{ height: 80 }} />
      </div>
    </div>
  )
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({ task, kidId, viewDate, coinPop, onComplete, now, isToday }) {
  const status = getTaskStatus(task, false, viewDate)
  const [countdown, setCountdown] = useState(secondsUntilChange(task, status))

  // Session = task_type 'session' or legacy 'focus', with a duration
  const sessionDuration = (() => {
    if (task.target_duration > 0) return task.target_duration
    if (!task.start_time || !task.deadline_time) return 0
    const [sh, sm] = task.start_time.split(':').map(Number)
    const [dh, dm] = task.deadline_time.split(':').map(Number)
    const secs = (dh * 60 + dm - sh * 60 - sm) * 60
    return secs > 0 ? secs : 0
  })()
  const isFocus = (task.task_type === 'session' || task.task_type === 'focus') && sessionDuration > 0

  // Session timer state — no pause, just Start → Stop → Start → Done
  const [timer, setTimer] = useState({
    running: false,
    hasStarted: false,
    remaining: sessionDuration,
    totalElapsed: 0,    // accumulated across all completed runs
  })
  const timerRef = useRef(null)
  const runStartRef = useRef(null)   // ISO string when current run began

  useEffect(() => {
    if (status === 'missed') return
    const t = setInterval(() => setCountdown(secondsUntilChange(task, getTaskStatus(task, false, viewDate))), 1000)
    return () => clearInterval(t)
  }, [status])

  // Timer tick — counts down, also tracks totalElapsed live
  useEffect(() => {
    if (!timer.running) { clearInterval(timerRef.current); return }
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        const newRemaining = Math.max(0, prev.remaining - 1)
        return { ...prev, remaining: newRemaining, totalElapsed: prev.totalElapsed + 1 }
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [timer.running])

  async function startTimer() {
    runStartRef.current = new Date().toISOString()
    setTimer(prev => ({ ...prev, running: true, hasStarted: true }))
  }

  async function stopTimer() {
    clearInterval(timerRef.current)
    const endedAt = new Date().toISOString()
    const startedAt = runStartRef.current
    if (startedAt) {
      const runSecs = Math.round((new Date(endedAt) - new Date(startedAt)) / 1000)
      if (runSecs > 0) {
        await supabase.from('session_runs').insert({
          task_id: task.id, kid_id: kidId, scheduled_date: viewDate,
          started_at: startedAt, ended_at: endedAt, duration_secs: runSecs,
        })
      }
    }
    runStartRef.current = null
    setTimer(prev => ({ ...prev, running: false }))
  }

  async function doneSession() {
    clearInterval(timerRef.current)
    const endedAt = new Date().toISOString()
    const startedAt = runStartRef.current
    let finalElapsed = timer.totalElapsed
    // Save current run if it was running
    if (startedAt && timer.running) {
      const runSecs = Math.round((new Date(endedAt) - new Date(startedAt)) / 1000)
      if (runSecs > 0) {
        await supabase.from('session_runs').insert({
          task_id: task.id, kid_id: kidId, scheduled_date: viewDate,
          started_at: startedAt, ended_at: endedAt, duration_secs: runSecs,
        })
        finalElapsed += runSecs
      }
    }
    runStartRef.current = null
    setTimer(prev => ({ ...prev, running: false }))
    onComplete(finalElapsed)
  }

  const statusConfig = {
    upcoming: { bg: 'rgba(255,255,255,0.03)', border: 'var(--border)',              label: 'Upcoming',     labelColor: '#94a3b8', icon: '⏰' },
    active:   { bg: 'rgba(245,197,24,0.06)',  border: 'rgba(245,197,24,0.25)',      label: 'Do it now!',   labelColor: '#f5c518', icon: '⚡' },
    grace:    { bg: 'rgba(249,115,22,0.06)',  border: 'rgba(249,115,22,0.25)',      label: 'Running late', labelColor: '#f97316', icon: '⚠️' },
    missed:   { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.2)',        label: 'Missed',       labelColor: '#ef4444', icon: '❌' },
  }
  const cfg = statusConfig[status] || statusConfig.upcoming
  const previewCoins = calculateCoins(task)
  const isActionable = isToday

  // Timer display colour
  const timerRatio = sessionDuration > 0 ? timer.remaining / sessionDuration : 1
  const timerColor = timerRatio > 0.5 ? '#22c55e' : timerRatio > 0.25 ? '#f97316' : '#ef4444'
  const totalElapsedMins = Math.floor(timer.totalElapsed / 60)
  const scheduledMins = Math.round(sessionDuration / 60)

  // Session cards get a blue left accent; task cards get standard styling
  const sessionAccent = isFocus ? '3px solid rgba(79,142,247,0.6)' : undefined

  return (
    <div style={{
      position: 'relative',
      background: isFocus ? 'rgba(79,142,247,0.04)' : cfg.bg,
      border: `1px solid ${isFocus ? 'rgba(79,142,247,0.25)' : cfg.border}`,
      borderLeft: sessionAccent || `1px solid ${cfg.border}`,
      borderRadius: 16,
      padding: '14px 16px',
      marginBottom: 10,
      opacity: status === 'upcoming' ? 0.75 : 1,
      transition: 'all 0.2s',
    }}>
      {/* Coin pop */}
      {coinPop && (
        <div className="coin-pop" style={{
          left: '50%', top: 0,
          color: coinPop.pending ? '#a855f7' : '#f5c518',
          fontSize: 18, fontWeight: 800,
        }}>
          {coinPop.pending ? '⏳' : '+'}{coinPop.amount}🪙
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 13, flexShrink: 0,
          background: status === 'missed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>
          {task.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{task.name}</span>
            <span className="badge" style={{
              background: cfg.bg, color: cfg.labelColor,
              border: `1px solid ${cfg.border}`, fontSize: 10,
            }}>
              {cfg.icon} {cfg.label}
            </span>
            {isFocus && (
              <span className="badge" style={{
                background: 'rgba(79,142,247,0.1)', color: '#4f8ef7',
                border: '1px solid rgba(79,142,247,0.3)', fontSize: 10,
              }}>
                ⏱ Session
              </span>
            )}
            {task.requires_approval && (
              <span className="badge" style={{
                background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                border: '1px solid rgba(168,85,247,0.3)', fontSize: 10,
              }}>
                👀 Parent checks
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {formatTime(task.start_time)} – {formatTime(task.deadline_time)}
            </span>
            {isToday && status !== 'missed' && countdown !== null && (
              <span style={{ fontSize: 12, color: cfg.labelColor, fontWeight: 600 }}>
                {status === 'upcoming' ? `Starts in ${formatCountdown(countdown)}` : `${formatCountdown(countdown)} left`}
              </span>
            )}
          </div>

          {/* Coins preview */}
          <div style={{ marginTop: 4, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
            color: task.requires_approval ? '#a855f7' : status === 'grace' ? '#f97316' : '#f5c518',
          }}>
            <GoldCoin size={12} />
            <span>
              {status === 'grace'
                ? `+${Math.max(1, Math.floor(task.full_coins / 2))} coins — late`
                : `+${previewCoins} coins`
              }
              {task.requires_approval ? ' · needs approval' : ''}
              {isFocus && sessionDuration > 0 && ` · ${formatDuration(sessionDuration)} session`}
            </span>
          </div>

          {/* Session timer display — shown once started */}
          {isFocus && timer.hasStarted && (
            <div style={{
              marginTop: 8, borderRadius: 10,
              background: 'rgba(0,0,0,0.3)', border: `1px solid ${timerColor}44`,
              overflow: 'hidden',
            }}>
              {/* Countdown + accumulated time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
                <div>
                  <span style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 28, fontWeight: 800, color: timerColor,
                    letterSpacing: -1, display: 'block',
                    ...(timer.running && timer.remaining < 30 ? { animation: 'timerPulse 1s infinite' } : {}),
                  }}>
                    {formatDuration(timer.remaining)}
                  </span>
                  <span style={{ fontSize: 10, color: '#475569' }}>remaining</span>
                </div>
                {timer.totalElapsed > 0 && (
                  <div style={{ marginLeft: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#4f8ef7', display: 'block' }}>
                      {formatDuration(timer.totalElapsed)}
                    </span>
                    <span style={{ fontSize: 10, color: '#475569' }}>studied so far</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                  {timer.running ? (
                    <button onClick={stopTimer} style={{
                      padding: '6px 14px', borderRadius: 8,
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                      color: '#ef4444', fontWeight: 700, fontSize: 13,
                    }}>⏹ Stop</button>
                  ) : timer.remaining > 0 ? (
                    <button onClick={startTimer} style={{
                      padding: '6px 14px', borderRadius: 8,
                      background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.4)',
                      color: '#4f8ef7', fontWeight: 700, fontSize: 13,
                    }}>▶ Resume</button>
                  ) : null}
                </div>
              </div>
              {/* Done button — full width at bottom */}
              {!timer.running && timer.totalElapsed > 0 && (
                <button onClick={doneSession} style={{
                  width: '100%', padding: '10px',
                  background: 'rgba(34,197,94,0.15)', borderTop: '1px solid rgba(34,197,94,0.2)',
                  color: '#22c55e', fontWeight: 800, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  ✅ Done — I studied {totalElapsedMins > 0 ? `${totalElapsedMins} min` : `${timer.totalElapsed}s`}
                  {timer.totalElapsed >= sessionDuration && <span style={{ color: '#f5c518' }}>🏆</span>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action buttons — only when viewing today */}
        {isActionable && status !== 'missed' && (
          <div style={{ flexShrink: 0 }}>
            {isFocus ? (
              !timer.hasStarted ? (
                // First start — blue session button
                <button
                  onClick={startTimer}
                  style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(79,142,247,0.2)', border: '1px solid rgba(79,142,247,0.4)',
                    color: '#4f8ef7', fontWeight: 700, fontSize: 13,
                  }}
                >▶ Start</button>
              ) : null  // controls move into the timer display panel once started
            ) : (
              // Quick task — green Done button
              <button
                onClick={() => onComplete(null)}
                style={{
                  padding: '12px 16px', borderRadius: 12,
                  background: status === 'grace'
                    ? 'rgba(249,115,22,0.2)' : 'rgba(34,197,94,0.15)',
                  border: status === 'grace'
                    ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(34,197,94,0.35)',
                  color: status === 'grace' ? '#f97316' : '#22c55e',
                  fontWeight: 700, fontSize: 13,
                }}
              >✓ Done</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
