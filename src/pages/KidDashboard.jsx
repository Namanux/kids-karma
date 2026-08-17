import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  calculateCoins, getTaskStatus, secondsUntilChange,
  formatCountdown, formatTime, formatCoins, coinsToLevel
} from '../lib/points'

// Use local date string (not UTC) to avoid midnight timezone bugs
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function KidDashboard() {
  const { profile, logout, refreshCurrentProfile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState([])
  const [messages, setMessages] = useState([])
  const [coinPops, setCoinPops] = useState([])
  const [ambient, setAmbient] = useState(false)
  const [now, setNow] = useState(new Date())
  const [shakeId, setShakeId] = useState(null)
  const [celebrateId, setCelebrateId] = useState(null)
  const idleTimer = useRef(null)

  // Local-date string for "today" (Brisbane-safe)
  const todayStr = localDateStr(now)

  // The date currently being viewed (can navigate to past/future)
  const [viewDate, setViewDate] = useState(todayStr)
  const viewDateRef = useRef(viewDate)
  useEffect(() => { viewDateRef.current = viewDate }, [viewDate])

  const isToday = viewDate === todayStr

  // Clock — also keeps todayStr fresh across midnight
  useEffect(() => {
    const t = setInterval(() => {
      const newNow = new Date()
      setNow(newNow)
      // If the day has ticked over and we're viewing "today", keep up
      if (viewDateRef.current === localDateStr(new Date(newNow - 1000))) {
        setViewDate(localDateStr(newNow))
      }
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Idle → ambient mode after 2 minutes
  function resetIdle() {
    clearTimeout(idleTimer.current)
    setAmbient(false)
    idleTimer.current = setTimeout(() => setAmbient(true), 2 * 60 * 1000)
  }

  useEffect(() => {
    resetIdle()
    window.addEventListener('touchstart', resetIdle)
    window.addEventListener('click', resetIdle)
    return () => {
      clearTimeout(idleTimer.current)
      window.removeEventListener('touchstart', resetIdle)
      window.removeEventListener('click', resetIdle)
    }
  }, [])

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
    // Parse date at noon local time to safely get the correct day-of-week
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

  async function completeTask(task) {
    const existing = completions.find(c => c.task_id === task.id)
    if (existing) return

    const status = getTaskStatus(task)

    const { count } = await supabase
      .from('task_completions')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', task.id)
      .eq('kid_id', profile.id)

    const completionNumber = (count || 0) + 1
    const needsApproval = completionNumber % task.requires_approval_every === 0

    const coinsEarned = calculateCoins(task)
    const approvalStatus = needsApproval ? 'pending_approval' : 'auto_approved'

    const { data: comp } = await supabase.from('task_completions').insert({
      task_id: task.id,
      kid_id: profile.id,
      scheduled_date: todayStr,   // always use local today
      coins_earned: coinsEarned,
      status: approvalStatus,
      completion_count: completionNumber,
    }).select().single()

    if (!needsApproval) {
      const { data: freshKid } = await supabase
        .from('profiles').select('coin_balance').eq('id', profile.id).single()
      const currentBalance = freshKid?.coin_balance || 0

      await supabase.from('coin_transactions').insert({
        kid_id: profile.id,
        amount: coinsEarned,
        reason: `Completed: ${task.name}`,
        transaction_type: 'task_reward',
        reference_id: comp?.id,
      })

      const { error: updateErr } = await supabase.from('profiles')
        .update({ coin_balance: Math.max(0, currentBalance + coinsEarned) })
        .eq('id', profile.id)

      if (updateErr) {
        console.error('Balance update failed:', updateErr.message)
      }

      setCelebrateId(task.id)
      setTimeout(() => setCelebrateId(null), 1500)
      popCoins(task.id, coinsEarned)
    }

    await loadTasks()
    await refreshCurrentProfile()
  }

  async function missTask(task) {
    const existing = completions.find(c => c.task_id === task.id)
    if (existing) return

    const honestyCoins = 1

    const { data: comp } = await supabase.from('task_completions').insert({
      task_id: task.id,
      kid_id: profile.id,
      scheduled_date: todayStr,   // always use local today
      coins_earned: honestyCoins,
      status: 'auto_approved',
      completion_count: 0,
    }).select().single()

    const { data: freshKid } = await supabase
      .from('profiles').select('coin_balance').eq('id', profile.id).single()
    const currentBalance = freshKid?.coin_balance || 0

    await supabase.from('coin_transactions').insert({
      kid_id: profile.id,
      amount: honestyCoins,
      reason: `Honest miss: ${task.name}`,
      transaction_type: 'task_reward',
      reference_id: comp?.id,
    })

    await supabase.from('profiles')
      .update({ coin_balance: Math.max(0, currentBalance + honestyCoins) })
      .eq('id', profile.id)

    popCoins(task.id, honestyCoins)
    await loadTasks()
    await refreshCurrentProfile()
  }

  function popCoins(taskId, amount) {
    const id = Date.now()
    setCoinPops(p => [...p, { id, taskId, amount }])
    setTimeout(() => setCoinPops(p => p.filter(x => x.id !== id)), 1000)
  }

  // Date navigation helpers
  function shiftDate(days) {
    const [y, m, d] = viewDate.split('-').map(Number)
    const next = new Date(y, m - 1, d + days, 12, 0, 0)
    setViewDate(localDateStr(next))
  }

  function viewDateLabel() {
    const [y, m, d] = viewDate.split('-').map(Number)
    const date = new Date(y, m - 1, d, 12, 0, 0)
    if (isToday) return date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' }) + ' · Today'
    const diffDays = Math.round((new Date(y, m - 1, d) - new Date(localDateStr(now).split('-').map((v,i) => i === 1 ? v-1 : +v).reduce((acc, v, i) => { const d = new Date(); if(i===0) d.setFullYear(v); if(i===1) d.setMonth(v); if(i===2) d.setDate(v); return d; }, new Date()))) / 86400000)
    return date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  // Simpler date label
  function formatViewDate() {
    const [y, m, d] = viewDate.split('-').map(Number)
    const date = new Date(y, m - 1, d, 12, 0, 0)
    const label = date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
    return isToday ? `${label} · Today` : label
  }

  const level = coinsToLevel(profile?.coin_balance || 0)
  const todayCompletedIds = new Set(completions.map(c => c.task_id))
  const totalToday = tasks.length
  const doneToday = tasks.filter(t => todayCompletedIds.has(t.id)).length

  if (ambient) return <AmbientMode profile={profile} tasks={tasks} completions={completions} now={now} onWake={() => setAmbient(false)} />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}
      onClick={resetIdle}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {/* Date row with left/right arrows */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={e => { e.stopPropagation(); shiftDate(-1) }}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                  fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >‹</button>
              <p style={{ color: '#94a3b8', fontSize: 13, flex: 1, textAlign: 'center' }}>
                {formatViewDate()}
              </p>
              <button
                onClick={e => { e.stopPropagation(); shiftDate(1) }}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                  fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >›</button>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>
              Hey {profile?.name}! {profile?.avatar_emoji}
            </h1>
          </div>
          <button onClick={logout} style={{
            fontSize: 12, color: '#475569', padding: '6px 10px',
            background: 'rgba(255,255,255,0.05)', borderRadius: 8, border: '1px solid var(--border)',
            marginLeft: 12,
          }}>
            Switch
          </button>
        </div>

        {/* Coin + Level bar */}
        <div style={{
          marginTop: 16, padding: 16,
          background: 'rgba(245,197,24,0.06)',
          border: '1px solid rgba(245,197,24,0.15)',
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 32 }}>{level.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: level.color }}>{level.label}</span>
              <span style={{ color: '#f5c518', fontWeight: 800, fontSize: 20 }}>
                🪙 {formatCoins(profile?.coin_balance || 0)}
              </span>
            </div>
            {level.next && (
              <>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${Math.min(100, ((profile?.coin_balance - level.min) / (level.next.min - level.min)) * 100)}%`,
                    background: `linear-gradient(90deg, ${level.color}, ${level.next.color})`,
                  }} />
                </div>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  {level.next.min - (profile?.coin_balance || 0)} coins to {level.next.label}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Progress for viewed date */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="progress-bar" style={{ flex: 1 }}>
            <div className="progress-fill" style={{
              width: totalToday > 0 ? `${(doneToday/totalToday)*100}%` : '0%',
              background: 'linear-gradient(90deg, #22c55e, #4f8ef7)',
            }} />
          </div>
          <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            {doneToday}/{totalToday} done
          </span>
        </div>
      </div>

      {/* Messages banner */}
      {messages.length > 0 && (
        <div style={{ padding: '0 16px', paddingTop: 12, flexShrink: 0 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{
              padding: '12px 16px', borderRadius: 12,
              background: 'rgba(168,85,247,0.1)',
              border: '1px solid rgba(168,85,247,0.3)',
              marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#a855f7' }}>
                  {msg.from?.avatar_emoji} {msg.from?.name} says:
                </span>
                <p style={{ fontSize: 14, marginTop: 2 }}>{msg.content}</p>
              </div>
              <button onClick={() => markMessageRead(msg.id)} style={{
                fontSize: 18, padding: 4, flexShrink: 0
              }}>✓</button>
            </div>
          ))}
        </div>
      )}

      {/* Past/future date notice */}
      {!isToday && (
        <div style={{
          margin: '8px 16px 0',
          padding: '8px 14px',
          borderRadius: 10,
          background: 'rgba(79,142,247,0.08)',
          border: '1px solid rgba(79,142,247,0.2)',
          fontSize: 12,
          color: '#4f8ef7',
          textAlign: 'center',
          flexShrink: 0,
        }}>
          📅 Viewing {viewDate < todayStr ? 'past' : 'future'} tasks — read only
          {' '}·{' '}
          <span
            onClick={e => { e.stopPropagation(); setViewDate(todayStr) }}
            style={{ textDecoration: 'underline', cursor: 'pointer' }}
          >Go to today</span>
        </div>
      )}

      {/* Task list */}
      <div className="scroll-y" style={{ flex: 1, padding: 16, paddingTop: 12 }}>
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <p style={{ fontWeight: 600, fontSize: 18 }}>No tasks{isToday ? ' today' : ' this day'}!</p>
            <p style={{ marginTop: 8, fontSize: 14 }}>{isToday ? 'Enjoy your free time.' : 'Nothing was scheduled.'}</p>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              completed={todayCompletedIds.has(task.id)}
              completion={completions.find(c => c.task_id === task.id)}
              onComplete={() => completeTask(task)}
              onMiss={() => missTask(task)}
              coinPop={coinPops.find(p => p.taskId === task.id)}
              celebrating={celebrateId === task.id}
              now={now}
              isToday={isToday}
            />
          ))
        )}

        {/* Spacer */}
        <div style={{ height: 80 }} />
      </div>
    </div>
  )
}

function TaskCard({ task, completed, completion, onComplete, onMiss, coinPop, celebrating, now, isToday }) {
  const status = completed ? 'done' : getTaskStatus(task, false)
  const [countdown, setCountdown] = useState(secondsUntilChange(task, status))

  useEffect(() => {
    if (status === 'done' || status === 'missed') return
    const t = setInterval(() => {
      setCountdown(secondsUntilChange(task, status))
    }, 1000)
    return () => clearInterval(t)
  }, [status])

  const statusConfig = {
    upcoming: { bg: 'rgba(255,255,255,0.03)', border: 'var(--border)', label: 'Upcoming', labelColor: '#94a3b8', icon: '⏰' },
    active:   { bg: 'rgba(245,197,24,0.06)',  border: 'rgba(245,197,24,0.25)', label: 'Do it now!', labelColor: '#f5c518', icon: '⚡' },
    grace:    { bg: 'rgba(249,115,22,0.06)',  border: 'rgba(249,115,22,0.25)', label: 'Running late', labelColor: '#f97316', icon: '⚠️' },
    done:     { bg: 'rgba(34,197,94,0.06)',   border: 'rgba(34,197,94,0.25)',  label: 'Done!', labelColor: '#22c55e', icon: '✅' },
    missed:   { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.2)',   label: 'Missed', labelColor: '#ef4444', icon: '❌' },
  }

  const cfg = statusConfig[status] || statusConfig.upcoming
  const previewCoins = calculateCoins(task)
  // Only show action buttons when viewing today and task isn't done
  const isActionable = isToday && status !== 'done'

  return (
    <div style={{
      position: 'relative',
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 16,
      padding: '16px 18px',
      marginBottom: 10,
      transition: 'all 0.2s',
      opacity: status === 'upcoming' ? 0.7 : 1,
    }}>
      {/* Coin pop */}
      {coinPop && (
        <div className="coin-pop" style={{ left: '50%', top: 0 }}>
          +🪙{coinPop.amount}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: status === 'done' ? 'rgba(34,197,94,0.15)' : status === 'missed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        }}>
          {completed ? '✅' : task.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{task.name}</span>
            <span className="badge" style={{
              background: cfg.bg, color: cfg.labelColor,
              border: `1px solid ${cfg.border}`, fontSize: 10,
            }}>
              {cfg.icon} {cfg.label}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {formatTime(task.start_time)} – {formatTime(task.deadline_time)}
            </span>
            {isToday && !completed && status !== 'missed' && countdown !== null && (
              <span style={{ fontSize: 12, color: cfg.labelColor, fontWeight: 600 }}>
                {status === 'upcoming' ? `Starts in ${formatCountdown(countdown)}` : `${formatCountdown(countdown)} left`}
              </span>
            )}
          </div>

          {!completed && isToday && (
            <div style={{ marginTop: 4, fontSize: 13, color: (status === 'grace' || status === 'missed') ? '#f97316' : '#f5c518' }}>
              {(status === 'grace' || status === 'missed')
                ? `⚠️ +${Math.max(1, Math.floor(task.full_coins / 2))} coins — late`
                : `🪙 +${previewCoins} coins`
              }
            </div>
          )}

          {completed && completion?.status === 'pending_approval' && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#a855f7' }}>
              ⏳ Waiting for parent approval
            </div>
          )}
          {completed && (
            <div style={{ marginTop: 4, fontSize: 13, color: '#22c55e' }}>
              🪙 +{completion?.coins_earned} earned
            </div>
          )}
        </div>

        {/* Action button — only when viewing today */}
        {isActionable && !completed && (
          (status === 'grace' || status === 'missed') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <button
                onClick={onComplete}
                className={celebrating ? 'glow' : ''}
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(249,115,22,0.15)',
                  border: '1px solid rgba(249,115,22,0.4)',
                  color: '#f97316', fontWeight: 700, fontSize: 12,
                }}
              >
                ✅ Done<br/>
                <span style={{ fontSize: 10, fontWeight: 500 }}>+{Math.max(1, Math.floor(task.full_coins / 2))}🪙</span>
              </button>
              <button
                onClick={onMiss}
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(168,85,247,0.12)',
                  border: '1px solid rgba(168,85,247,0.3)',
                  color: '#a855f7', fontWeight: 700, fontSize: 12,
                }}
              >
                😔 Missed<br/>
                <span style={{ fontSize: 10, fontWeight: 500 }}>+1🪙 honest</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onComplete}
              className={celebrating ? 'glow' : ''}
              style={{
                padding: '14px 18px', borderRadius: 12,
                background: 'rgba(245,197,24,0.2)',
                border: '1px solid rgba(245,197,24,0.4)',
                color: '#f5c518', fontWeight: 700, fontSize: 13, flexShrink: 0,
              }}
            >
              Done!
            </button>
          )
        )}
      </div>
    </div>
  )
}

function AmbientMode({ profile, tasks, completions, now, onWake }) {
  const todayCompletedIds = new Set(completions.map(c => c.task_id))
  const nextTask = tasks.find(t => !todayCompletedIds.has(t.id) && getTaskStatus(t) !== 'missed')

  const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateStr = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div
      onClick={onWake}
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        background: '#000000',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {/* Clock — large, white only */}
        <div style={{
          fontSize: 'clamp(64px, 18vw, 100px)',
          fontWeight: 300,
          letterSpacing: -2,
          color: '#ffffff',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {timeStr}
        </div>

        {/* Date */}
        <div style={{
          fontSize: 18, color: 'rgba(255,255,255,0.45)',
          marginTop: 12, fontWeight: 400, letterSpacing: 0.5,
        }}>
          {dateStr}
        </div>

        {/* Next task — subtle, white only */}
        {nextTask && (
          <div style={{
            marginTop: 36,
            color: 'rgba(255,255,255,0.25)',
            fontSize: 14,
            fontWeight: 400,
          }}>
            Next: {nextTask.icon} {nextTask.name} · {formatTime(nextTask.start_time)}
          </div>
        )}
      </div>

      {/* Tap hint */}
      <div style={{
        position: 'absolute', bottom: 32,
        fontSize: 12, color: 'rgba(255,255,255,0.12)',
        letterSpacing: 1,
      }}>
        TAP TO WAKE
      </div>
    </div>
  )
}
