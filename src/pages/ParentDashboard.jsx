import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatCoins, coinsToLevel, formatTime, getTaskStatus, calculateCoins } from '../lib/points'
import * as XLSX from 'xlsx'

/* Emoji font stack — ensures emoji render as color glyphs, not CJK fallbacks */
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif'

/* ─── Emoji Picker ─── */
/* BMP-only emoji (U+0000–U+FFFF) — guaranteed to render on all systems */
const TASK_EMOJIS = [
  // Learning & work
  '✏️','✒️','✂️','☑️','❓','❗','➕','➗','⌚',
  // Nature & sky
  '☀️','⭐','☁️','⛅','☔','❄️','⚡','☄️','⛄',
  // Spiritual & wellbeing
  '☯️','☸️','✝️','☪️','✡️','⛩️','☺️','☹️','❤️',
  // Sports & activity
  '⚽','⚾','⛳','⛵','⛷️','⛸️','⛹️','⚔️',
  // Food & drink
  '☕','⛽','⚗️',
  // Tools & objects
  '⚙️','⚓','⚖️','⚛️','✈️','⛺','⛲','⛰️',
  // Status & actions
  '✨','♻️','♿','⚠️','⛔','✅','❌','⚡',
  '⬆️','⬇️','➡️','↩️','♾️',
]

function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: 64, height: 52, fontSize: 24,
          background: 'rgba(255,255,255,0.05)',
          border: open ? '1px solid var(--accent-gold)' : '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: EMOJI_FONT,
          transition: 'border-color 0.15s',
        }}
        title="Pick emoji"
      >{value || '⭐'}</button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, padding: 10, marginTop: 4,
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 2, width: 296, maxHeight: 220, overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          }}>
            {TASK_EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => { onChange(e); setOpen(false) }}
                style={{
                  fontSize: 22, padding: '5px 2px', borderRadius: 6,
                  fontFamily: EMOJI_FONT,
                  background: value === e ? 'rgba(245,197,24,0.2)' : 'transparent',
                  border: value === e ? '1px solid rgba(245,197,24,0.4)' : '1px solid transparent',
                  cursor: 'pointer', lineHeight: 1.2,
                }}>{e}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const TABS = ['Overview', 'Approve', 'Task', 'Reward', 'Message']

/* ─── Kid avatar colour ring ─── */
const KID_ACCENT = {
  default: '#4f8ef7',
}

export default function ParentDashboard() {
  const { profile, profiles, logout } = useAuth()
  const [tab, setTab] = useState('Overview')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const ch = supabase.channel('parent-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, () => {
        loadPendingCount()
      })
      .subscribe()
    loadPendingCount()
    return () => ch.unsubscribe()
  }, [])

  async function loadPendingCount() {
    const { count } = await supabase
      .from('task_completions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_approval')
    setPendingCount(count || 0)
  }

  const kids = profiles.filter(p => p.role === 'kid')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>

      {/* ── Slim Navbar ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        height: 52,
        gap: 8,
      }}>
        {/* Greeting */}
        <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', marginRight: 4 }}>
          Hey {profile?.name}! 👋
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flex: 1, gap: 2, overflowX: 'auto', alignItems: 'stretch', height: '100%' }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                position: 'relative',
                padding: '0 13px',
                height: '100%',
                background: 'transparent',
                color: tab === t ? '#fff' : '#64748b',
                fontWeight: tab === t ? 700 : 500,
                fontSize: 13,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                borderBottom: tab === t ? '2px solid var(--accent-gold)' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {t}
              {t === 'Approve' && pendingCount > 0 && (
                <span style={{
                  position: 'absolute', top: 8, right: 2,
                  background: '#ef4444', color: 'white',
                  fontSize: 9, fontWeight: 800, width: 14, height: 14,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Switch */}
        <button onClick={logout} style={{
          fontSize: 11, color: '#475569', padding: '5px 10px',
          background: 'rgba(255,255,255,0.05)', borderRadius: 7,
          border: '1px solid var(--border)', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          Switch
        </button>
      </div>

      {/* Content */}
      <div className="scroll-y" style={{ flex: 1, padding: '14px 14px 0' }}>
        {tab === 'Overview' && <OverviewTab kids={kids} />}
        {tab === 'Approve' && <ApproveTab onApprove={loadPendingCount} />}
        {tab === 'Task'    && <TasksTab kids={kids} />}
        {tab === 'Reward'  && <RewardsTab kids={kids} />}
        {tab === 'Message' && <MessageTab kids={kids} profile={profile} />}
        <div style={{ height: 60 }} />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   OVERVIEW TAB
═══════════════════════════════════════════ */
function OverviewTab({ kids }) {
  const [period, setPeriod] = useState('today')
  const [kidData, setKidData] = useState([])
  const [chartData, setChartData] = useState([])   // [{label, kids:[{name,done,total,color}]}]
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadData() }, [kids.length, period])

  async function loadData() {
    setLoading(true)
    const dayOfWeek = new Date().getDay()

    // ── Today's data (always needed for stats) ──
    const data = await Promise.all(kids.map(async kid => {
      const { data: tasks } = await supabase.from('tasks').select('*')
        .eq('assigned_to', kid.id).eq('is_active', true).contains('days_of_week', [dayOfWeek])
      const { data: comps } = await supabase.from('task_completions').select('*')
        .eq('kid_id', kid.id).eq('scheduled_date', today)
      const startOfDay = today + 'T00:00:00'
      const { data: txns } = await supabase.from('coin_transactions').select('amount')
        .eq('kid_id', kid.id).gte('created_at', startOfDay).gt('amount', 0)
      const earnedToday = (txns || []).reduce((sum, t) => sum + t.amount, 0)
      return { ...kid, tasks: tasks || [], completions: comps || [], earnedToday }
    }))
    setKidData(data)

    // ── Chart data for week / month ──
    if (period !== 'today') {
      const days = period === 'week' ? 7 : 30
      const dates = Array.from({ length: days }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (days - 1 - i))
        return d.toISOString().split('T')[0]
      })
      const startDate = dates[0]
      const { data: allComps } = await supabase
        .from('task_completions')
        .select('kid_id, scheduled_date, status')
        .in('kid_id', kids.map(k => k.id))
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', today)

      const kidColors = ['#ec4899', '#4f8ef7', '#a855f7', '#22c55e']
      const grouped = dates.map(date => {
        const d = new Date(date + 'T12:00:00')
        const label = period === 'week'
          ? d.toLocaleDateString('en-AU', { weekday: 'short' })
          : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
        return {
          label,
          date,
          kids: kids.map((kid, idx) => ({
            name: kid.name,
            color: kidColors[idx % kidColors.length],
            done: (allComps || []).filter(
              c => c.scheduled_date === date && c.kid_id === kid.id && c.status !== 'rejected'
            ).length,
          }))
        }
      })
      setChartData(grouped)
    }
    setLoading(false)
  }

  const kidColors = ['#ec4899', '#4f8ef7', '#a855f7', '#22c55e']

  return (
    <div>
      {/* ── Period Toggle ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['today', 'week', 'month'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: period === p ? 'var(--accent-gold)' : 'rgba(255,255,255,0.06)',
              color: period === p ? '#0f0f1a' : '#94a3b8',
              border: period === p ? 'none' : '1px solid var(--border)',
              textTransform: 'capitalize',
            }}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {/* ── Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kids.length}, 1fr)`, gap: 10, marginBottom: 14 }}>
        {kidData.map((kid, idx) => {
          const level = coinsToLevel(kid.coin_balance || 0)
          const done = kid.completions.filter(c => c.status !== 'rejected').length
          const total = kid.tasks.length
          return (
            <div key={kid.id} style={{
              background: 'var(--bg-card)',
              border: `1px solid ${kidColors[idx % kidColors.length]}33`,
              borderRadius: 'var(--radius)',
              padding: '14px 14px 12px',
            }}>
              {/* Kid header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: kid.avatar_color || kidColors[idx % kidColors.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  border: `2px solid ${kidColors[idx % kidColors.length]}66`,
                }}>
                  {kid.avatar_emoji || '😊'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{kid.name}</div>
                  <div style={{ fontSize: 11, color: '#f5c518' }}>{level.emoji} {level.label}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: total > 0 ? `${(done / total) * 100}%` : '0%',
                  background: done === total && total > 0 ? '#22c55e' : kidColors[idx % kidColors.length],
                  transition: 'width 0.5s',
                }} />
              </div>

              {/* 3 stat chips */}
              <div style={{ display: 'flex', gap: 6 }}>
                <StatChip label="Balance" value={`🪙 ${formatCoins(kid.coin_balance || 0)}`} color={kidColors[idx % kidColors.length]} />
                <StatChip label="Earned today" value={`+${kid.earnedToday}`} color="#f5c518" />
                <StatChip label="Done" value={`${done}/${total}`} color="#22c55e" />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Today: Calendar Grid ── */}
      {period === 'today' && <CalendarGrid kids={kids} kidColors={kidColors} onApprovalComplete={loadData} />}

      {/* ── Week / Month: Bar Chart ── */}
      {period !== 'today' && chartData.length > 0 && (
        <CompletionChart data={chartData} period={period} kids={kids} kidColors={kidColors} />
      )}
    </div>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div style={{
      flex: 1, background: `${color}12`, border: `1px solid ${color}28`,
      borderRadius: 8, padding: '6px 4px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{label}</div>
    </div>
  )
}

/* ── Calendar constants ── */
const PX_PER_HOUR = 120  // 120px = 1 hour → 2px per minute
const CAL_START   = 5    // 5 am  (captures early wake-up tasks)
const CAL_END     = 22   // 10 pm
const CAL_HOURS   = Array.from({ length: CAL_END - CAL_START }, (_, i) => i + CAL_START)
const TOTAL_H     = (CAL_END - CAL_START) * PX_PER_HOUR

function hourLabel(h) {
  if (h === 0) return '12am'
  if (h < 12)  return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function timeToMinutes(t = '00:00') {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function timeToY(t) {
  return (timeToMinutes(t) - CAL_START * 60) * (PX_PER_HOUR / 60)
}

/* ── Collision detection → lane assignments ──
   Returns array of { task, col, totalCols } where:
   - col       = which lane this task sits in (0-based)
   - totalCols = how many lanes exist in its overlap group
   Tasks that don't overlap at all get col=0, totalCols=1 (full width).
   Tasks that share any time overlap are split into side-by-side lanes.
*/
function layoutTasks(tasks) {
  if (!tasks.length) return []

  // Build overlap groups using a sweep
  // Step 1: for every task, find all tasks whose time range intersects it
  function rangeEnd(t) {
    // For sessions, use target_duration; for tasks, use expiry_time
    if ((t.task_type === 'session' || t.task_type === 'focus') && t.target_duration) {
      return timeToMinutes(t.start_time) + Math.round(t.target_duration / 60)
    }
    const e = timeToMinutes(t.expiry_time || t.start_time)
    return e > timeToMinutes(t.start_time) ? e : timeToMinutes(t.start_time) + 30
  }

  const assigned = tasks.map(task => {
    const s = timeToMinutes(task.start_time)
    const e = rangeEnd(task)

    // All tasks (incl. self) that overlap this task's window
    const group = tasks
      .filter(other => {
        const os = timeToMinutes(other.start_time)
        const oe = rangeEnd(other)
        return os < e && oe > s   // intervals overlap
      })
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time) || a.id - b.id)

    // Assign columns greedily within the group
    // col = index in a "column array" where last-placed task doesn't overlap
    const cols = []   // cols[i] = end-time of last task placed in lane i
    let myCol = 0
    for (const t of group) {
      const ts = timeToMinutes(t.start_time)
      let placed = false
      for (let c = 0; c < cols.length; c++) {
        if (cols[c] <= ts) { cols[c] = rangeEnd(t); if (t.id === task.id) myCol = c; placed = true; break }
      }
      if (!placed) { if (t.id === task.id) myCol = cols.length; cols.push(rangeEnd(t)) }
    }

    return { task, col: myCol, totalCols: cols.length }
  })

  return assigned
}

/* ── Vertical task stack for quick tasks ──
   Sorts tasks by start_time and stacks them top-to-bottom.
   Each task gets a fixed TASK_H height. If a later task's natural
   timeToY position would overlap the previous block, it gets pushed down
   so they never overlap — maintaining a clean vertical list.
   Returns { task, y } where y is the absolute pixel top.
*/
const QUICK_TASK_H = 13
const QUICK_TASK_GAP = 1

function stackQuickTasks(tasks) {
  if (!tasks.length) return []
  const sorted = [...tasks].sort((a, b) =>
    timeToMinutes(a.start_time) - timeToMinutes(b.start_time) || (a.id > b.id ? 1 : -1)
  )
  // Stack tasks top-to-bottom. If the next task's natural time position
  // is already below where we'd place it, snap to that time (new group).
  // If not, keep stacking underneath the previous task (same group).
  let nextY = -Infinity
  return sorted.map(task => {
    const naturalY = timeToY(task.start_time)
    const y = Math.max(naturalY, nextY)
    nextY = y + QUICK_TASK_H + QUICK_TASK_GAP
    return { task, y }
  })
}

const STATUS_META = {
  done:     { label: 'Done',   color: '#22c55e', bg: 'rgba(34,197,94,0.18)',   icon: '✅' },
  active:   { label: 'Now',    color: '#f5c518', bg: 'rgba(245,197,24,0.18)',  icon: '⏳' },
  grace:    { label: 'Late',   color: '#f97316', bg: 'rgba(249,115,22,0.18)',  icon: '⚠️' },
  missed:   { label: 'Missed', color: '#ef4444', bg: 'rgba(239,68,68,0.18)',   icon: '❌' },
  upcoming: { label: 'Soon',   color: '#475569', bg: 'rgba(71,85,105,0.14)',   icon: '🕐' },
  pending:  { label: 'Review', color: '#a855f7', bg: 'rgba(168,85,247,0.18)', icon: '👀' },
}

/* ── Self-contained Google-Calendar grid ── */
function CalendarGrid({ kids, kidColors, onApprovalComplete }) {
  const todayStr = () => new Date().toISOString().split('T')[0]

  const [selDate, setSelDate]       = useState(new Date())
  const [kidData, setKidData]       = useState([])
  const [nowY,    setNowY]          = useState(null)
  const [sheet,   setSheet]         = useState(null)   // { task, comp, kid }
  const scrollRef                   = useRef()

  const dateStr = selDate.toISOString().split('T')[0]
  const isToday = dateStr === todayStr()

  /* live time line */
  useEffect(() => {
    function tick() {
      const n = new Date()
      const y = timeToY(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`)
      setNowY(y >= 0 && y <= TOTAL_H ? y : null)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  /* auto-scroll to now when viewing today */
  useEffect(() => {
    if (isToday && scrollRef.current && nowY !== null) {
      scrollRef.current.scrollTop = Math.max(0, nowY - 120)
    }
  }, [isToday, dateStr])

  /* load tasks + completions for selected date */
  useEffect(() => { loadData() }, [kids.length, dateStr])

  async function loadData() {
    const dow = selDate.getDay()
    const data = await Promise.all(kids.map(async kid => {
      const { data: tasks } = await supabase.from('tasks').select('*')
        .eq('assigned_to', kid.id).eq('is_active', true).contains('days_of_week', [dow])
      const { data: comps } = await supabase.from('task_completions').select('*')
        .eq('kid_id', kid.id).eq('scheduled_date', dateStr)
      // Load session runs for today — total mins per task
      const { data: runs } = await supabase.from('session_runs').select('task_id, duration_secs')
        .eq('kid_id', kid.id).eq('scheduled_date', dateStr)
      // Group runs by task_id
      const runsByTask = {}
      for (const r of (runs || [])) {
        runsByTask[r.task_id] = (runsByTask[r.task_id] || 0) + (r.duration_secs || 0)
      }
      const sessions = (tasks || []).filter(t => t.task_type === 'session' || t.task_type === 'focus')
      const quickTasks = (tasks || []).filter(t => t.task_type !== 'session' && t.task_type !== 'focus')
      return { ...kid, tasks: tasks || [], sessions, quickTasks, completions: comps || [], runsByTask }
    }))
    setKidData(data)
  }

  function changeDate(delta) {
    const d = new Date(selDate)
    d.setDate(d.getDate() + delta)
    setSelDate(d)
  }

  /* status for a task+completion pair */
  function taskStatus(task, comp) {
    if (!comp) return getTaskStatus(task)
    if (comp.status === 'rejected') return 'missed'
    if (comp.status === 'pending_approval') return 'pending'
    return 'done'
  }

  /* block height for sessions — proportional to target_duration so a
     5-min yoga block stays tiny and a 30-min study block is tall.
     Min 24px so the label is always readable. */
  function blockHeight(task) {
    const isSession = task.task_type === 'session' || task.task_type === 'focus'
    if (isSession && task.target_duration) {
      const mins = Math.round(task.target_duration / 60)
      return Math.max(24, mins * (PX_PER_HOUR / 60))
    }
    // Fallback for tasks without target_duration
    const start = timeToMinutes(task.start_time || '00:00')
    const end   = timeToMinutes(task.expiry_time || task.start_time || '00:30')
    const diff  = end - start
    return Math.max(24, diff > 0 ? diff * (PX_PER_HOUR / 60) : 30)
  }

  /* date label */
  const dateLabel = isToday
    ? 'Today'
    : selDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

  /* ── approval handlers ── */
  async function handleApprove(coins) {
    const { comp, task, kid } = sheet
    await supabase.from('task_completions').update({ status: 'approved', coins_earned: coins }).eq('id', comp.id)
    await supabase.from('coin_transactions').insert({
      kid_id: comp.kid_id, amount: coins,
      reason: `Approved: ${task.name}`, transaction_type: 'task_reward', reference_id: comp.id,
    })
    const { data: kidRow } = await supabase.from('profiles').select('coin_balance').eq('id', comp.kid_id).single()
    await supabase.from('profiles').update({ coin_balance: Math.max(0, (kidRow?.coin_balance || 0) + coins) }).eq('id', comp.kid_id)
    setSheet(null)
    loadData()
    onApprovalComplete?.()
  }

  async function handleReject() {
    await supabase.from('task_completions').update({ status: 'rejected' }).eq('id', sheet.comp.id)
    setSheet(null)
    loadData()
    onApprovalComplete?.()
  }

  const colCount = kidData.length

  return (
    <div>
      {/* ── Date navigation ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button
          onClick={() => changeDate(-1)}
          style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)', fontSize: 16, color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
          {dateLabel}
          {!isToday && <span style={{ fontSize: 11, color: '#475569', marginLeft: 6 }}>
            {selDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>}
        </div>
        <button
          onClick={() => changeDate(1)}
          style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)', fontSize: 16, color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >›</button>
        {!isToday && (
          <button
            onClick={() => setSelDate(new Date())}
            style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(245,197,24,0.12)', border: '1px solid rgba(245,197,24,0.3)', color: '#f5c518', fontSize: 12, fontWeight: 600 }}
          >Today</button>
        )}
      </div>

      {/* ── Calendar body ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `44px repeat(${colCount}, 1fr)`,
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.03)',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div />
          {kidData.map((kid, idx) => (
            <div key={kid.id} style={{
              padding: '10px 8px', display: 'flex', alignItems: 'center', gap: 6,
              borderLeft: '1px solid rgba(255,255,255,0.06)',
              fontWeight: 700, fontSize: 13,
              color: kidColors[idx % kidColors.length],
            }}>
              <span style={{ fontSize: 16 }}>{kid.avatar_emoji}</span>
              {kid.name}
            </div>
          ))}
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} style={{ overflowY: 'auto', maxHeight: '62vh' }}>
          <div style={{ position: 'relative', height: TOTAL_H }}>

            {/* Grid columns */}
            <div style={{ display: 'grid', gridTemplateColumns: `44px repeat(${colCount}, 1fr)`, height: '100%' }}>

              {/* Time labels column */}
              <div style={{ position: 'relative', background: 'rgba(0,0,0,0.08)' }}>
                {CAL_HOURS.map(h => (
                  <div key={h} style={{
                    position: 'absolute',
                    top: (h - CAL_START) * PX_PER_HOUR - 8,
                    right: 6, fontSize: 10,
                    color: h === new Date().getHours() && isToday ? '#f5c518' : '#475569',
                    fontWeight: h === new Date().getHours() && isToday ? 700 : 400,
                    userSelect: 'none',
                  }}>
                    {hourLabel(h)}
                  </div>
                ))}
              </div>

              {/* Kid columns — sessions (blue, left half) + tasks (gold, right half) in same vertical column */}
              {kidData.map((kid, idx) => (
                <div key={kid.id} style={{ position: 'relative', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Hour grid lines */}
                  {CAL_HOURS.map(h => (
                    <div key={h} style={{
                      position: 'absolute',
                      top: (h - CAL_START) * PX_PER_HOUR,
                      left: 0, right: 0, height: 1,
                      background: h % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    }} />
                  ))}

                  {/* Vertical divider between sessions and tasks halves */}
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'rgba(255,255,255,0.04)', zIndex: 1 }} />

                  {/* Sessions — occupy left 50% of column */}
                  {layoutTasks(kid.sessions || []).map(({ task, col, totalCols }) => {
                    const comp    = kid.completions.find(c => c.task_id === task.id)
                    const status  = taskStatus(task, comp)
                    const meta    = STATUS_META[status] || STATUS_META.upcoming
                    const top     = timeToY(task.start_time)
                    const h       = blockHeight(task)
                    const isMissed  = status === 'missed'
                    const isPending = status === 'pending'
                    const totalSecs = kid.runsByTask?.[task.id] || 0
                    const scheduledMins = task.target_duration ? Math.round(task.target_duration / 60) : null
                    const GAP = 2
                    // Sessions live in left 50%; split further if they overlap each other
                    const halfW = 50
                    const laneW    = `calc(${halfW / totalCols}% - ${GAP}px)`
                    const laneLeft = `calc(${(col / totalCols) * halfW}% + ${GAP / 2}px)`
                    return (
                      <div key={task.id} onClick={() => setSheet({ task, comp, kid })} style={{
                        position: 'absolute', top, height: h, left: laneLeft, width: laneW,
                        background: status === 'done' ? meta.bg : 'rgba(79,142,247,0.14)',
                        border: `1px solid ${status === 'done' ? meta.color + '44' : 'rgba(79,142,247,0.4)'}`,
                        borderLeft: `3px solid ${status === 'done' ? meta.color : '#4f8ef7'}`,
                        borderRadius: 5, padding: '4px 6px', cursor: 'pointer', overflow: 'hidden',
                        opacity: isMissed ? 0.65 : 1,
                        boxShadow: isPending ? `0 0 0 1px ${meta.color}66` : 'none',
                        zIndex: 5, boxSizing: 'border-box',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, height: '100%' }}>
                          <span style={{ fontSize: h < 50 ? 11 : 14, flexShrink: 0, lineHeight: 1.3, fontFamily: EMOJI_FONT }}>{task.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: h < 50 ? 10 : 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isMissed ? 'line-through' : 'none' }}>
                              {task.name}
                            </div>
                            {h >= 52 && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{formatTime(task.start_time)}</div>}
                            {h >= 52 && totalSecs > 0 && scheduledMins && (
                              <div style={{ fontSize: 10, color: '#4f8ef7', marginTop: 1 }}>⏱ {Math.round(totalSecs / 60)}/{scheduledMins}m</div>
                            )}
                          </div>
                          {h >= 36 && <span style={{ fontSize: 10, flexShrink: 0 }}>{meta.icon}</span>}
                        </div>
                      </div>
                    )
                  })}

                  {/* Tasks — right 50%, stacked top-to-bottom, no horizontal splitting */}
                  {stackQuickTasks(kid.quickTasks || []).map(({ task, y }) => {
                    const comp      = kid.completions.find(c => c.task_id === task.id)
                    const status    = taskStatus(task, comp)
                    const meta      = STATUS_META[status] || STATUS_META.upcoming
                    const isMissed  = status === 'missed'
                    const isPending = status === 'pending'
                    return (
                      <div key={task.id} onClick={() => setSheet({ task, comp, kid })} style={{
                        position: 'absolute',
                        top: y,
                        height: QUICK_TASK_H,
                        left: 'calc(50% + 2px)',
                        right: 2,
                        background: meta.bg,
                        border: `1px solid ${meta.color}33`,
                        borderLeft: `2px solid ${meta.color}`,
                        borderRadius: 2, padding: '0 3px', cursor: 'pointer', overflow: 'hidden',
                        opacity: isMissed ? 0.55 : 1,
                        boxShadow: isPending ? `0 0 0 1px ${meta.color}55` : 'none',
                        zIndex: 5, boxSizing: 'border-box',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{ fontSize: 8, flexShrink: 0, lineHeight: 1, fontFamily: EMOJI_FONT }}>{task.icon}</span>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 8, fontWeight: 600, color: meta.color, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isMissed ? 'line-through' : 'none' }}>
                          {task.name}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* ── Live time line (today only) ── */}
            {isToday && nowY !== null && (
              <div style={{
                position: 'absolute', top: nowY, left: 44, right: 0,
                height: 2, background: '#ef4444', zIndex: 15, pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', left: -5, top: -4,
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 6px #ef4444',
                }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Task detail / approval bottom sheet ── */}
      {sheet && (
        <TaskSheet
          sheet={sheet}
          onClose={() => setSheet(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          taskStatus={taskStatus}
        />
      )}
    </div>
  )
}

/* ── Bottom sheet: task detail + inline approval ── */
function TaskSheet({ sheet, onClose, onApprove, onReject, taskStatus }) {
  const { task, comp, kid } = sheet
  const status = taskStatus(task, comp)
  const meta   = STATUS_META[status] || STATUS_META.upcoming
  const isPending = status === 'pending'
  const isSession = task.task_type === 'session' || task.task_type === 'focus'

  const defaultCoins = comp?.coins_earned ?? task.full_coins ?? 20
  const [coins, setCoins] = useState(defaultCoins)
  const [note,  setNote]  = useState('')
  const [sessionRuns, setSessionRuns] = useState([])

  useEffect(() => {
    if (!isSession) return
    const today = new Date().toISOString().split('T')[0]
    supabase.from('session_runs')
      .select('*')
      .eq('task_id', task.id)
      .eq('kid_id', kid.id)
      .eq('scheduled_date', today)
      .order('started_at')
      .then(({ data }) => setSessionRuns(data || []))
  }, [task.id])

  const totalSessionSecs = sessionRuns.reduce((s, r) => s + (r.duration_secs || 0), 0)
  const scheduledMins = task.target_duration ? Math.round(task.target_duration / 60) : null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1a2e',
          borderRadius: '20px 20px 0 0',
          padding: '8px 16px 36px',
          width: '100%',
          maxHeight: '70vh',
          overflowY: 'auto',
          borderTop: `3px solid ${meta.color}`,
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '8px auto 16px' }} />

        {/* Kid + task header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: kid.avatar_color || '#4f8ef7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>{kid.avatar_emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{kid.name}</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}><span style={{ fontFamily: EMOJI_FONT }}>{task.icon}</span> {task.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {formatTime(task.start_time)}
              {isSession && task.target_duration && ` → ${(() => { const [sh,sm]=(task.start_time||'00:00').split(':').map(Number); const total=sh*60+sm+Math.round(task.target_duration/60); return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}` })()}`}
              {!isSession && task.expiry_time && ` (expires ${formatTime(task.expiry_time)})`}
              {isSession && <span style={{ color: '#4f8ef7', marginLeft: 6 }}>⏱ Session</span>}
            </div>
            {/* Session time summary */}
            {isSession && totalSessionSecs > 0 && (
              <div style={{
                marginTop: 8, padding: '6px 10px', borderRadius: 8,
                background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4f8ef7' }}>
                  ⏱ {Math.round(totalSessionSecs / 60)} min studied
                  {scheduledMins && ` of ${scheduledMins} min`}
                </span>
                {totalSessionSecs >= (task.target_duration || 0) && task.target_duration > 0 && (
                  <span style={{ fontSize: 12, color: '#f5c518' }}>🏆 Full session!</span>
                )}
              </div>
            )}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: meta.bg, color: meta.color, border: `1px solid ${meta.color}44`,
          }}>
            {meta.icon} {meta.label}
          </span>
        </div>

        {/* Completion time (if done / pending) */}
        {comp && comp.completed_at && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 14,
            fontSize: 13, color: '#94a3b8',
          }}>
            Marked done at {new Date(comp.completed_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
            {comp.completion_count && ` · Completion #${comp.completion_count}`}
          </div>
        )}

        {/* ── Inline approval controls (pending only) ── */}
        {isPending && (
          <>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Coins to award</p>

              {/* Coin adjuster */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <button
                  onClick={() => setCoins(c => Math.max(0, c - 5))}
                  style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.08)', fontSize: 20, color: 'white', fontWeight: 700 }}
                >−</button>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 28, fontWeight: 900, color: '#f5c518' }}>
                  🪙 {coins}
                </div>
                <button
                  onClick={() => setCoins(c => c + 5)}
                  style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.08)', fontSize: 20, color: 'white', fontWeight: 700 }}
                >+</button>
              </div>

              {/* Preset buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[0, task.min_coins, task.full_coins].filter(v => v !== undefined && v !== null).map(v => (
                  <button key={v} onClick={() => setCoins(v)} style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: coins === v ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${coins === v ? 'rgba(245,197,24,0.4)' : 'var(--border)'}`,
                    color: coins === v ? '#f5c518' : '#94a3b8',
                  }}>
                    {v === 0 ? '0 (none)' : v === task.min_coins ? `${v} (min)` : `${v} (full)`}
                  </button>
                ))}
              </div>
            </div>

            {/* Note input */}
            <input
              className="input-field"
              placeholder="Note to kid (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ marginBottom: 12, fontSize: 14 }}
            />

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onReject} className="btn btn-danger" style={{ flex: 1, padding: '14px', fontSize: 15 }}>
                ❌ Reject
              </button>
              <button onClick={() => onApprove(coins)} className="btn btn-success" style={{ flex: 2, padding: '14px', fontSize: 15, fontWeight: 800 }}>
                ✅ Approve 🪙 {coins}
              </button>
            </div>
          </>
        )}

        {/* ── Non-pending info ── */}
        {!isPending && (
          <div style={{ display: 'flex', gap: 10 }}>
            {status === 'done' && (
              <div style={{ flex: 1, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>🪙 {comp?.coins_earned ?? '—'}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Coins earned</div>
              </div>
            )}
            {status === 'missed' && (
              <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>😔</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Task was missed</div>
              </div>
            )}
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f5c518', marginBottom: 4 }}>🪙 {task.full_coins}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Full · {task.min_coins} Min</div>
              {task.penalty_coins > 0 && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>−{task.penalty_coins} Penalty</div>}
            </div>
          </div>
        )}

        {/* Close */}
        <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: '#64748b', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }}>
          Close
        </button>
      </div>
    </div>
  )
}

/* ── Bar Chart for week / month ── */
function CompletionChart({ data, period, kids, kidColors }) {
  const maxDone = Math.max(1, ...data.flatMap(d => d.kids.map(k => k.done)))

  // For month, group into weeks to avoid crowding
  const displayData = period === 'month'
    ? (() => {
        const weeks = []
        for (let i = 0; i < data.length; i += 7) {
          const chunk = data.slice(i, i + 7)
          const label = chunk[0].label
          const kidTotals = kids.map((kid, idx) => ({
            name: kid.name,
            color: kidColors[idx % kidColors.length],
            done: chunk.reduce((s, d) => s + (d.kids[idx]?.done || 0), 0),
          }))
          weeks.push({ label, kids: kidTotals })
        }
        return weeks
      })()
    : data

  const barW = period === 'week' ? 28 : 18
  const groupGap = period === 'week' ? 28 : 12
  const kidGap = 3
  const chartH = 140
  const leftPad = 32
  const rightPad = 12
  const totalGroupW = kids.length * barW + (kids.length - 1) * kidGap
  const totalW = leftPad + displayData.length * (totalGroupW + groupGap) + rightPad

  const yMax = Math.max(1, ...displayData.flatMap(d => d.kids.map(k => k.done)))

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '16px 14px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {period === 'week' ? 'Weekly' : 'Monthly'} Completion
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          {kids.map((kid, idx) => (
            <div key={kid.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: kidColors[idx % kidColors.length] }} />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{kid.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg width={Math.max(totalW, 280)} height={chartH + 28} style={{ display: 'block' }}>
          {/* Y grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = chartH - f * chartH + 4
            return (
              <g key={f}>
                <line x1={leftPad - 4} y1={y} x2={totalW - rightPad} y2={y}
                  stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                <text x={leftPad - 6} y={y + 4} textAnchor="end"
                  fontSize={9} fill="#475569">
                  {Math.round(f * yMax)}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {displayData.map((group, gi) => {
            const groupX = leftPad + gi * (totalGroupW + groupGap)
            return (
              <g key={gi}>
                {group.kids.map((k, ki) => {
                  const barH = yMax > 0 ? Math.round((k.done / yMax) * (chartH - 8)) : 0
                  const x = groupX + ki * (barW + kidGap)
                  const y = chartH - barH + 4
                  return (
                    <g key={ki}>
                      <rect x={x} y={y} width={barW} height={barH}
                        rx={3} fill={k.color} opacity={0.85} />
                      {k.done > 0 && (
                        <text x={x + barW / 2} y={y - 3} textAnchor="middle"
                          fontSize={9} fill={k.color} fontWeight="700">
                          {k.done}
                        </text>
                      )}
                    </g>
                  )
                })}
                {/* X label */}
                <text
                  x={groupX + totalGroupW / 2}
                  y={chartH + 18}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#64748b"
                >
                  {group.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   APPROVE TAB
═══════════════════════════════════════════ */
function ApproveTab({ onApprove }) {
  const [queue, setQueue] = useState([])

  useEffect(() => { loadQueue() }, [])

  async function loadQueue() {
    const { data } = await supabase
      .from('task_completions')
      .select('*, task:task_id(*), kid:kid_id(*)')
      .eq('status', 'pending_approval')
      .order('created_at')
    setQueue(data || [])
  }

  // Photo evidence has served its purpose once a parent has decided — delete it and clear the path
  async function deletePhotoEvidence(comp) {
    if (!comp.photo_path) return
    await supabase.storage.from('task-photos').remove([comp.photo_path])
  }

  async function approve(comp, adjustedCoins) {
    await supabase.from('task_completions').update({
      status: 'approved', coins_earned: adjustedCoins, photo_path: null,
    }).eq('id', comp.id)
    await supabase.from('coin_transactions').insert({
      kid_id: comp.kid_id, amount: adjustedCoins,
      reason: `Approved: ${comp.task?.name}`,
      transaction_type: 'task_reward', reference_id: comp.id,
    })
    const { data: kid } = await supabase.from('profiles').select('coin_balance').eq('id', comp.kid_id).single()
    await supabase.from('profiles').update({
      coin_balance: Math.max(0, (kid?.coin_balance || 0) + adjustedCoins)
    }).eq('id', comp.kid_id)
    await deletePhotoEvidence(comp)
    loadQueue(); onApprove()
  }

  async function reject(comp) {
    await supabase.from('task_completions').update({ status: 'rejected', photo_path: null }).eq('id', comp.id)
    await deletePhotoEvidence(comp)
    loadQueue(); onApprove()
  }

  if (queue.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <p style={{ fontWeight: 600 }}>Nothing to approve</p>
      <p style={{ fontSize: 14, marginTop: 8 }}>You're all caught up!</p>
    </div>
  )

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Needs Your Review ({queue.length})</h2>
      {queue.map(comp => (
        <ApprovalCard key={comp.id} comp={comp} onApprove={approve} onReject={reject} />
      ))}
    </div>
  )
}

function ApprovalCard({ comp, onApprove, onReject }) {
  const [coins, setCoins] = useState(comp.coins_earned)
  const [note, setNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)

  useEffect(() => {
    if (!comp.photo_path) return
    let cancelled = false
    supabase.storage.from('task-photos').createSignedUrl(comp.photo_path, 3600).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setPhotoUrl(data.signedUrl)
    })
    return () => { cancelled = true }
  }, [comp.photo_path])

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: comp.kid?.avatar_color || '#4f8ef7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{comp.kid?.avatar_emoji || '😊'}</div>
        <div>
          <div style={{ fontWeight: 700 }}>{comp.kid?.name}</div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>{comp.task?.icon} {comp.task?.name}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            Completion #{comp.completion_count} · {new Date(comp.completed_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {comp.photo_path && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>📷 Photo evidence</p>
          {photoUrl ? (
            <a href={photoUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={photoUrl}
                alt="Task evidence"
                style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)', display: 'block' }}
              />
            </a>
          ) : (
            <div style={{
              padding: 24, textAlign: 'center', color: '#475569',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 12,
            }}>Loading photo…</div>
          )}
          <p style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
            Tap to view full size · deleted automatically once you approve or reject
          </p>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Coins to award</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setCoins(c => Math.max(0, c - 5))} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', fontSize: 18, color: 'white' }}>−</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 24, fontWeight: 800, color: '#f5c518' }}>🪙 {coins}</div>
          <button onClick={() => setCoins(c => c + 5)} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', fontSize: 18, color: 'white' }}>+</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {[0, comp.task?.min_coins, comp.task?.full_coins].filter(Boolean).map(v => (
            <button key={v} onClick={() => setCoins(v)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12,
              background: coins === v ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${coins === v ? 'rgba(245,197,24,0.4)' : 'var(--border)'}`,
              color: coins === v ? '#f5c518' : '#94a3b8',
            }}>
              {v === 0 ? '0 (none)' : v === comp.task?.min_coins ? `${v} (min)` : `${v} (full)`}
            </button>
          ))}
        </div>
      </div>

      <input className="input-field" placeholder="Add a note (optional)" value={note}
        onChange={e => setNote(e.target.value)} style={{ marginBottom: 12, fontSize: 14 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onReject(comp)} className="btn btn-danger" style={{ flex: 1 }}>Reject</button>
        <button onClick={() => onApprove(comp, coins)} className="btn btn-success" style={{ flex: 2 }}>Approve 🪙 {coins}</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   TASKS TAB
═══════════════════════════════════════════ */
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function TasksTab({ kids }) {
  const [tasks, setTasks] = useState([])
  const [pendingKidTasks, setPendingKidTasks] = useState([])
  const [form, setForm] = useState(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef(null)

  useEffect(() => { loadTasks(); loadPendingKidTasks() }, [])

  async function loadTasks() {
    const { data } = await supabase.from('tasks')
      .select('*, kid:assigned_to(name, avatar_emoji)')
      .neq('is_active', false).order('start_time')
    setTasks(data || [])
  }

  async function loadPendingKidTasks() {
    const { data } = await supabase.from('tasks')
      .select('*, kid:assigned_to(name, avatar_emoji)')
      .eq('pending_parent_review', true)
      .order('created_at', { ascending: false })
    setPendingKidTasks(data || [])
  }

  async function approveKidTask(task) {
    const { error } = await supabase.from('tasks')
      .update({ is_active: true, pending_parent_review: false })
      .eq('id', task.id)
    if (error) { alert('Approve failed: ' + error.message); return }
    loadPendingKidTasks(); loadTasks()
  }

  async function rejectKidTask(task) {
    if (!confirm(`Reject "${task.name}"? This can't be undone.`)) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) { alert('Reject failed: ' + error.message); return }
    loadPendingKidTasks()
  }

  async function saveTask(task) {
    let error, data
    if (task.id) {
      ({ error, data } = await supabase.from('tasks').update({ ...task, is_active: true }).eq('id', task.id).select())
    } else {
      ({ error, data } = await supabase.from('tasks').insert({ ...task, is_active: true }).select())
    }
    if (error) { alert('Save failed: ' + error.message); console.error('saveTask error:', error); return }
    console.log('saveTask success:', data)
    setForm(null); loadTasks()
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return
    const { error } = await supabase.from('tasks').update({ is_active: false }).eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); return }
    loadTasks()
  }

  async function exportToExcel() {
    const rows = tasks.map(t => {
      const isSession = t.task_type === 'session' || t.task_type === 'focus'
      return {
        name: t.name, icon: t.icon, assigned_to: t.kid?.name || '',
        days: (t.days_of_week || []).map(d => DAY_NAMES[d]).join(','),
        start_date: t.start_date || '',
        end_date: t.end_date || '',
        start_time: t.start_time,
        end_time: isSession && t.target_duration
          ? (() => { const [sh, sm] = (t.start_time || '00:00').split(':').map(Number); const total = sh * 60 + sm + Math.round(t.target_duration / 60); return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}` })()
          : '',
        expiry_time: !isSession ? (t.expiry_time || '') : '',
        full_coins: t.full_coins, min_coins: t.min_coins, penalty_coins: t.penalty_coins,
        approval: t.approval || 'auto',
        task_type: t.task_type || 'task',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [20,8,14,20,12,12,14,14,12,10,14,10].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks')
    XLSX.writeFile(wb, 'kids-karma-tasks.xlsx')
  }

  function excelTimeToHHMM(val) {
    if (!val && val !== 0) return null
    if (typeof val === 'string' && val.includes(':')) return val.trim()  // already HH:MM
    if (typeof val === 'number') {
      const totalMinutes = Math.round(val * 24 * 60)
      const h = Math.floor(totalMinutes / 60) % 24
      const m = totalMinutes % 60
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    }
    return String(val).trim() || null
  }

  async function importFromExcel(e) {
    const file = e.target.files[0]; if (!file) return
    setImporting(true)
    try {
      const ab = await file.arrayBuffer(); const wb = XLSX.read(ab)
      const ws = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(ws)
      let imported = 0, skipped = 0
      for (const row of rows) {
        const kid = kids.find(k => k.name.toLowerCase() === (row.assigned_to || '').toLowerCase())
        if (!kid || !row.name) { skipped++; continue }
        const days = String(row.days || '').split(',').map(d => DAY_NAMES.indexOf(d.trim())).filter(d => d >= 0)

        // Detect session: has an end_time column, or task_type column = 'session'
        const hasEndTime = row.end_time && String(row.end_time).trim().length > 0
        const typeFromCol = String(row.task_type || '').toLowerCase()
        const isSession = hasEndTime || typeFromCol === 'session'

        const startTime = excelTimeToHHMM(row.start_time) || '07:00'
        const endTime   = hasEndTime ? excelTimeToHHMM(row.end_time) : null

        // Compute target_duration for sessions from end_time
        let targetDuration = null
        if (isSession && startTime && endTime) {
          const [sh, sm] = startTime.split(':').map(Number)
          const [eh, em] = endTime.split(':').map(Number)
          const secs = (eh * 60 + em - sh * 60 - sm) * 60
          if (secs > 0) targetDuration = secs
        }

        const approvalVal = String(row.approval || '').toLowerCase() === 'review' ? 'review' : 'auto'
        await supabase.from('tasks').insert({
          name: String(row.name), icon: String(row.icon || '⭐'), assigned_to: kid.id,
          days_of_week: days, start_time: startTime,
          start_date: row.start_date ? String(row.start_date) : null,
          end_date: row.end_date ? String(row.end_date) : null,
          expiry_time: isSession ? null : (excelTimeToHHMM(row.expiry_time) || '08:00'),
          note: row.note ? String(row.note) : null,
          full_coins: parseInt(row.full_coins) || 20, min_coins: parseInt(row.min_coins) || 5,
          penalty_coins: parseInt(row.penalty_coins) || 10,
          approval: approvalVal,
          task_type: isSession ? 'session' : 'task',
          target_duration: targetDuration,
          is_active: true,
        }); imported++
      }
      alert(`✅ Imported ${imported} task${imported !== 1 ? 's' : ''}${skipped ? ` (${skipped} skipped — unknown kid name)` : ''}.`)
      loadTasks()
    } catch (err) { alert('Import failed: ' + err.message) }
    setImporting(false); e.target.value = ''
  }

  if (form !== null) return <TaskForm task={form} kids={kids} onSave={saveTask} onCancel={() => setForm(null)} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ fontWeight: 700 }}>Tasks</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {tasks.length > 0 && (
            <button onClick={async () => {
              if (!confirm(`Delete all ${tasks.length} tasks? This cannot be undone.`)) return
              const { error } = await supabase.from('tasks').update({ is_active: false }).not('id', 'is', null)
              if (error) { alert('Clear All failed: ' + error.message); return }
              loadTasks()
            }} style={{ padding: '10px 18px', fontSize: 14, borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontWeight: 600 }}>
              🗑 Clear All
            </button>
          )}
          <button onClick={() => setForm({})} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 14 }}>+ New Task</button>
        </div>
      </div>

      {pendingKidTasks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, color: '#a855f7', marginBottom: 10 }}>
            💡 Pending from kids ({pendingKidTasks.length})
          </h3>
          {pendingKidTasks.map(task => (
            <div key={task.id} className="card" style={{
              marginBottom: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28, flexShrink: 0, fontFamily: EMOJI_FONT }}>{task.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{task.name}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    {task.kid?.avatar_emoji} {task.kid?.name} · wants to start {formatTime(task.start_time)}
                  </div>
                  <div style={{ fontSize: 12, color: '#f5c518', marginTop: 2 }}>🪙 suggested {task.full_coins} coins</div>
                </div>
              </div>
              {task.note && (
                <div style={{
                  fontSize: 13, color: '#cbd5e1', fontStyle: 'italic', margin: '10px 0 0',
                  padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                }}>
                  "{task.note}"
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => rejectKidTask(task)} className="btn btn-danger" style={{ flex: 1 }}>Reject</button>
                <button onClick={() => approveKidTask(task)} className="btn btn-success" style={{ flex: 2 }}>Approve ✓</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#94a3b8', flex: 1 }}>📊 Excel</span>
        <button onClick={exportToExcel} disabled={tasks.length === 0} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', cursor: 'pointer' }}>↓ Export</button>
        <button onClick={() => importRef.current?.click()} disabled={importing} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(79,142,247,0.12)', color: '#4f8ef7', border: '1px solid rgba(79,142,247,0.25)', cursor: 'pointer' }}>
          {importing ? 'Importing…' : '↑ Import'}
        </button>
        <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importFromExcel} />
      </div>

      {tasks.map(task => (
        <div key={task.id} className="card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28, flexShrink: 0, fontFamily: EMOJI_FONT }}>{task.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{task.name}</span>
              {(task.task_type === 'session' || task.task_type === 'focus')
                ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(79,142,247,0.12)', color: '#4f8ef7', border: '1px solid rgba(79,142,247,0.3)' }}>⏱ Session</span>
                : <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>✓ Task</span>
              }
              {task.requires_approval
                ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>👀 Review</span>
                : null
              }
              {task.requires_photo
                ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>📷 Photo</span>
                : null
              }
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>{task.kid?.avatar_emoji} {task.kid?.name} · {formatTime(task.start_time)}</div>
            <div style={{ fontSize: 12, color: '#f5c518', marginTop: 2 }}>🪙 {task.full_coins} full · {task.min_coins} min · −{task.penalty_coins} penalty</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setForm(task)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>Edit</button>
            <button onClick={() => deleteTask(task.id)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Del</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function TaskFormIconRow({ icon, children, noBorder }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '12px 0',
      borderBottom: noBorder ? 'none' : '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ fontSize: 18, width: 22, textAlign: 'center', flexShrink: 0, marginTop: 2, opacity: 0.6 }}>{icon}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function TaskForm({ task, kids, onSave, onCancel }) {
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const todayStr = new Date().toISOString().split('T')[0]
  const isSession = task.task_type === 'session' || task.task_type === 'focus'
  const [form, setForm] = useState({
    name: task.name || '', icon: task.icon || '⭐', description: task.description || '',
    assigned_to: task.assigned_to || kids[0]?.id || '',
    days_of_week: task.days_of_week || [1,2,3,4,5],
    start_date: task.start_date || todayStr,
    end_date: task.end_date || '',
    no_end_date: !task.end_date,
    start_time: task.start_time || '07:00',
    session_end_time: task.target_duration
      ? (() => { const [sh, sm] = (task.start_time || '07:00').split(':').map(Number); const total = sh * 60 + sm + Math.round((task.target_duration || 0) / 60); return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}` })()
      : '07:30',
    expiry_time: task.expiry_time || '08:00',
    full_coins: task.full_coins || 20,
    min_coins: task.min_coins || 5, penalty_coins: task.penalty_coins || 10,
    approval: task.approval || 'auto',
    requires_photo: task.requires_photo || false,
    id: task.id,
    task_type: task.task_type || 'task',
    note: task.note || '',
  })

  function toggleDay(d) {
    setForm(f => ({ ...f, days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter(x => x !== d) : [...f.days_of_week, d] }))
  }

  const assignedKid = kids.find(k => k.id === form.assigned_to)
  const formIsSession = form.task_type === 'session'

  function computeTargetDuration(startTime, endTime) {
    if (!startTime || !endTime) return null
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const secs = (eh * 60 + em - sh * 60 - sm) * 60
    return secs > 0 ? secs : null
  }

  function handleSave() {
    const taskData = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      description: form.description || null,
      icon: form.icon,
      note: form.note || null,
      assigned_to: form.assigned_to,
      days_of_week: form.days_of_week,
      start_date: form.no_end_date ? form.start_date : (form.start_date || null),
      end_date: form.no_end_date ? null : (form.end_date || null),
      start_time: form.start_time,
      expiry_time: formIsSession ? null : (form.expiry_time || '08:00'),
      full_coins: form.full_coins,
      min_coins: form.min_coins,
      penalty_coins: form.penalty_coins,
      approval: form.approval || 'auto',
      requires_photo: form.requires_photo,
      task_type: formIsSession ? 'session' : 'task',
      target_duration: formIsSession
        ? computeTargetDuration(form.start_time, form.session_end_time)
        : null,
    }
    onSave(taskData)
  }

  /* ── field row helper — defined outside TaskForm to prevent focus loss on re-render ── */
  const IconRow = TaskFormIconRow

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* ── Title bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onCancel} style={{
          width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--border)', color: '#94a3b8', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
        <h2 style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>{form.id ? 'Edit Task' : 'New Task'}</h2>
        <button
          onClick={handleSave}
          className="btn btn-primary"
          style={{ padding: '10px 24px', fontSize: 14 }}
        >
          {form.id ? 'Save' : 'Create'}
        </button>
      </div>

      {/* ── Main card ── */}
      <div className="card" style={{ padding: '4px 16px' }}>

        {/* Task name + emoji */}
        <IconRow icon="✏️">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <EmojiPicker value={form.icon} onChange={emoji => setForm(f => ({ ...f, icon: emoji }))} />
            <input
              className="input-field"
              value={form.name}
              placeholder="Task name"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ flex: 1, fontSize: 18, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, padding: '10px 4px' }}
              autoFocus
            />
          </div>
        </IconRow>

        {/* Task type toggle — Task or Session */}
        <IconRow icon="🎯">
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Type</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'task',    label: '✓ Task',     desc: 'Quick checkbox — tap Done',   color: '#22c55e' },
              { value: 'session', label: '⏱ Session',  desc: 'Timed focus — Start / Stop',  color: '#4f8ef7' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, task_type: opt.value }))}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 12, textAlign: 'left',
                  background: form.task_type === opt.value ? `${opt.color}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${form.task_type === opt.value ? opt.color + '55' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: form.task_type === opt.value ? opt.color : '#94a3b8' }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </IconRow>

        {/* Assigned to */}
        <IconRow icon="👤">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {kids.map(k => (
              <button
                key={k.id}
                onClick={() => setForm(f => ({ ...f, assigned_to: k.id }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 20, fontSize: 14, fontWeight: 600,
                  background: form.assigned_to === k.id ? 'rgba(245,197,24,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${form.assigned_to === k.id ? 'rgba(245,197,24,0.5)' : 'var(--border)'}`,
                  color: form.assigned_to === k.id ? '#f5c518' : '#94a3b8',
                }}
              >
                <span style={{ fontSize: 16 }}>{k.avatar_emoji}</span> {k.name}
              </button>
            ))}
          </div>
        </IconRow>

        {/* Days */}
        <IconRow icon="📅">
          <div style={{ marginBottom: 6, fontSize: 12, color: '#64748b' }}>Repeats on</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DAYS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{
                width: 38, height: 38, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                background: form.days_of_week.includes(i) ? '#4f8ef7' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${form.days_of_week.includes(i) ? '#4f8ef7' : 'var(--border)'}`,
                color: form.days_of_week.includes(i) ? '#fff' : '#94a3b8',
              }}>{d}</button>
            ))}
          </div>
        </IconRow>

        {/* Date range */}
        <IconRow icon="🗓">
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Active dates</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Start date</div>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                  borderRadius: 10, color: '#e2e8f0', fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ color: '#475569', fontSize: 14, marginTop: 16, flexShrink: 0 }}>→</div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>End date</div>
              {form.no_end_date
                ? (
                  <button
                    onClick={() => setForm(f => ({ ...f, no_end_date: false, end_date: f.start_date }))}
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 14, textAlign: 'left',
                      background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
                      borderRadius: 10, color: '#475569',
                    }}
                  >No end date</button>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      value={form.end_date}
                      min={form.start_date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 12px', fontSize: 14,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                        borderRadius: 10, color: '#e2e8f0', fontFamily: 'inherit',
                      }}
                    />
                    <button
                      onClick={() => setForm(f => ({ ...f, no_end_date: true, end_date: '' }))}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        color: '#475569', fontSize: 14, lineHeight: 1,
                      }}
                    >✕</button>
                  </div>
                )
              }
            </div>
          </div>
        </IconRow>

        {/* Times */}
        <IconRow icon="⏰">
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Schedule</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Start</div>
              <input type="time" className="input-field" value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                style={{ padding: '10px 12px', fontSize: 14 }} />
            </div>
            {formIsSession && (
              <>
                <div style={{ color: '#475569', fontSize: 14, marginTop: 16, flexShrink: 0 }}>→</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#4f8ef7', marginBottom: 4 }}>⏱ Session end</div>
                  <input type="time" className="input-field" value={form.session_end_time}
                    onChange={e => setForm(f => ({ ...f, session_end_time: e.target.value }))}
                    style={{ padding: '10px 12px', fontSize: 14, borderColor: 'rgba(79,142,247,0.3)' }} />
                </div>
              </>
            )}
          </div>

          {/* Duration hint for sessions */}
          {formIsSession && form.start_time && form.session_end_time && (() => {
            const dur = computeTargetDuration(form.start_time, form.session_end_time)
            if (!dur || dur <= 0) return null
            const mins = Math.round(dur / 60)
            return (
              <div style={{ fontSize: 12, color: '#4f8ef7', marginBottom: 10, paddingLeft: 2 }}>
                ⏱ {mins} minute session
              </div>
            )
          })()}

          {/* Expires — tasks only */}
          {!formIsSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#ef4444', marginBottom: 4 }}>❌ Expires (missed after)</div>
                <input type="time" className="input-field" value={form.expiry_time}
                  onChange={e => setForm(f => ({ ...f, expiry_time: e.target.value }))}
                  style={{ padding: '10px 12px', fontSize: 14, borderColor: 'rgba(239,68,68,0.3)' }} />
              </div>
              <div style={{ flex: 1 }} />
            </div>
          )}
        </IconRow>

        {/* Coins */}
        <IconRow icon="🪙">
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Coins</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Full reward', key: 'full_coins',    accent: '#f5c518' },
              { label: 'Minimum',     key: 'min_coins',     accent: '#94a3b8' },
              { label: 'Penalty',     key: 'penalty_coins', accent: '#ef4444' },
            ].map(({ label, key, accent }) => (
              <div key={key} style={{
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${accent}22`,
                borderRadius: 10, padding: '10px 10px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: accent, fontWeight: 600, marginBottom: 6 }}>{label}</div>
                <input
                  type="number" min={0}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
                  style={{
                    width: '100%', textAlign: 'center', fontSize: 20, fontWeight: 800,
                    color: accent, background: 'transparent', border: 'none', outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </IconRow>

        {/* Parent approval */}
        <IconRow icon="👀">
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Approval</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'auto',   label: '⚡ Auto',   desc: 'Coins land instantly', color: '#22c55e' },
              { value: 'review', label: '👀 Review', desc: 'You approve first',    color: '#a855f7' },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, approval: opt.value }))} style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                background: form.approval === opt.value ? `${opt.color}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${form.approval === opt.value ? opt.color + '66' : 'var(--border)'}`,
                color: form.approval === opt.value ? opt.color : '#94a3b8',
                cursor: 'pointer',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
                <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </IconRow>

        {/* Photo evidence */}
        <IconRow icon="📷">
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Photo evidence</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: false, label: '✓ No photo',   desc: 'Just tap Done',            color: '#94a3b8' },
              { value: true,  label: '📷 Required',   desc: 'Kid must attach a photo',  color: '#a855f7' },
            ].map(opt => (
              <button key={String(opt.value)} type="button" onClick={() => setForm(f => ({ ...f, requires_photo: opt.value }))} style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                background: form.requires_photo === opt.value ? `${opt.color}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${form.requires_photo === opt.value ? opt.color + '66' : 'var(--border)'}`,
                color: form.requires_photo === opt.value ? opt.color : '#94a3b8',
                cursor: 'pointer',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
                <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          {form.requires_photo && (
            <div style={{ fontSize: 11, color: '#a855f7', marginTop: 6, paddingLeft: 2 }}>
              📷 Photo tasks always go to your Approve tab, even with Auto approval
            </div>
          )}
        </IconRow>

        {/* Notes */}
        <IconRow icon="📝" noBorder>
          <textarea
            placeholder="Add a note (visible to the kid)…"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            rows={3}
            style={{
              width: '100%', resize: 'none', fontSize: 14, color: '#e2e8f0',
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit',
            }}
          />
        </IconRow>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════
   REWARDS TAB
═══════════════════════════════════════════ */
function RewardsTab({ kids }) {
  const [rewards, setRewards] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '🎁', coin_cost: 100, description: '' })

  useEffect(() => { loadRewards(); loadRedemptions() }, [])

  async function loadRewards() {
    const { data } = await supabase.from('rewards').select('*').eq('is_active', true)
    setRewards(data || [])
  }

  async function loadRedemptions() {
    const { data } = await supabase.from('reward_redemptions')
      .select('*, kid:kid_id(name, avatar_emoji), reward:reward_id(name, icon)')
      .eq('status', 'pending').order('created_at', { ascending: false })
    setRedemptions(data || [])
  }

  async function saveReward() {
    await supabase.from('rewards').insert(form)
    setShowForm(false); setForm({ name: '', icon: '🎁', coin_cost: 100, description: '' }); loadRewards()
  }

  async function approveRedemption(r) {
    await supabase.from('reward_redemptions').update({ status: 'approved' }).eq('id', r.id); loadRedemptions()
  }

  async function rejectRedemption(r) {
    await supabase.from('coin_transactions').insert({ kid_id: r.kid_id, amount: r.coins_spent, reason: `Refund: ${r.reward?.name}`, transaction_type: 'adjustment' })
    const { data: kid } = await supabase.from('profiles').select('coin_balance').eq('id', r.kid_id).single()
    await supabase.from('profiles').update({ coin_balance: (kid?.coin_balance || 0) + r.coins_spent }).eq('id', r.kid_id)
    await supabase.from('reward_redemptions').update({ status: 'rejected' }).eq('id', r.id); loadRedemptions()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontWeight: 700 }}>Rewards</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 14 }}>+ New Reward</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <EmojiPicker value={form.icon} onChange={emoji => setForm(f => ({ ...f, icon: emoji }))} />
            <input className="input-field" value={form.name} placeholder="Reward name" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ flex: 1 }} />
          </div>
          <input className="input-field" value={form.description} placeholder="Description (optional)" onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ color: '#f5c518', fontSize: 16 }}>🪙 Cost:</span>
            <input type="number" className="input-field" value={form.coin_cost} style={{ width: 100 }} onChange={e => setForm(f => ({ ...f, coin_cost: parseInt(e.target.value) || 0 }))} />
          </div>
          <button onClick={saveReward} className="btn btn-primary" style={{ width: '100%' }}>Save Reward</button>
        </div>
      )}

      {redemptions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontWeight: 600, color: '#f97316', marginBottom: 10 }}>⏳ Pending Redemptions</h3>
          {redemptions.map(r => (
            <div key={r.id} className="card" style={{ marginBottom: 8, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{r.kid?.avatar_emoji} {r.kid?.name}</span>
                  <span style={{ color: '#94a3b8', marginLeft: 8 }}>wants {r.reward?.icon} {r.reward?.name}</span>
                  <div style={{ fontSize: 13, color: '#f5c518', marginTop: 4 }}>🪙 {r.coins_spent} coins</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => rejectRedemption(r)} className="btn btn-danger" style={{ padding: '8px 14px', fontSize: 13 }}>Deny</button>
                  <button onClick={() => approveRedemption(r)} className="btn btn-success" style={{ padding: '8px 14px', fontSize: 13 }}>Give</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontWeight: 600, marginBottom: 10, color: '#94a3b8' }}>Available Rewards</h3>
      {rewards.map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28, fontFamily: EMOJI_FONT }}>{r.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            {r.description && <div style={{ fontSize: 13, color: '#94a3b8' }}>{r.description}</div>}
          </div>
          <div style={{ color: '#f5c518', fontWeight: 700 }}>🪙 {r.coin_cost}</div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════
   MESSAGE TAB
═══════════════════════════════════════════ */
function MessageTab({ kids, profile }) {
  const [to, setTo] = useState(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  async function send() {
    if (!text.trim()) return
    await supabase.from('messages').insert({ from_id: profile.id, to_id: to || null, content: text.trim() })
    setText(''); setSent(true); setTimeout(() => setSent(false), 2000)
  }

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Send a Message</h2>
      <div className="card">
        <Row label="To">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setTo(null)} style={{ padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, background: to === null ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${to === null ? 'rgba(245,197,24,0.5)' : 'var(--border)'}`, color: to === null ? '#f5c518' : '#94a3b8' }}>All kids</button>
            {kids.map(k => (
              <button key={k.id} onClick={() => setTo(k.id)} style={{ padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, background: to === k.id ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${to === k.id ? 'rgba(245,197,24,0.5)' : 'var(--border)'}`, color: to === k.id ? '#f5c518' : '#94a3b8' }}>
                {k.avatar_emoji} {k.name}
              </button>
            ))}
          </div>
        </Row>
        <div style={{ marginTop: 14 }}>
          <textarea className="input-field" placeholder="Type your message..." value={text} onChange={e => setText(e.target.value)} rows={4}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, width: '100%', resize: 'none', fontSize: 15 }} />
        </div>
        <button onClick={send} disabled={!text.trim()} className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
          {sent ? '✅ Sent!' : '📨 Send Message'}
        </button>
      </div>
    </div>
  )
}
