/**
 * Points / coin calculation engine
 *
 * Each task has:
 *   full_coins    – awarded if completed before deadline_time
 *   min_coins     – minimum awarded if completed before expiry_time
 *   penalty_coins – deducted if not completed by expiry_time
 *
 * Between deadline_time and expiry_time, coins decay linearly from
 * full_coins down to min_coins.
 */

/**
 * Given a task and the time of completion, return coins earned.
 * Pass null for completedAt to calculate penalty (not completed).
 */
export function calculateCoins(task, completedAt = new Date()) {
  const now = new Date(completedAt)
  const today = now.toISOString().split('T')[0]

  // Use expiry_time as the "active window end" (was deadline_time)
  const activeEnd = task.expiry_time || task.start_time
  const deadline = activeEnd ? new Date(`${today}T${activeEnd}`) : null

  if (!deadline || now <= deadline) {
    return task.full_coins
  }

  // After deadline (late or missed) — half coins, minimum 1
  return Math.max(1, Math.floor(task.full_coins / 2))
}

export function calculatePenalty(task) {
  return -Math.abs(task.penalty_coins)
}

/**
 * Current task status based on time of day
 */
export function getTaskStatus(task, completedToday = false, viewDate = null) {
  if (completedToday) return 'done'

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const dateStr = viewDate || todayStr

  // For future dates, all tasks are upcoming; for past dates, all missed
  if (dateStr > todayStr) return 'upcoming'
  if (dateStr < todayStr) return 'missed'

  // Today: compare against real clock
  const start  = new Date(`${dateStr}T${task.start_time}`)
  // For sessions: active until start + target_duration; for tasks: active until expiry_time
  const isSession = task.task_type === 'session' || task.task_type === 'focus'
  let activeEnd, expiry
  if (isSession && task.target_duration) {
    const [sh, sm] = (task.start_time || '00:00').split(':').map(Number)
    const endMins = sh * 60 + sm + Math.round(task.target_duration / 60)
    const endStr = `${String(Math.floor(endMins/60)%24).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`
    activeEnd = new Date(`${dateStr}T${endStr}`)
    expiry = activeEnd
  } else {
    const expiryStr = task.expiry_time || task.start_time
    activeEnd = expiryStr ? new Date(`${dateStr}T${expiryStr}`) : start
    expiry = activeEnd
  }

  if (now < start)      return 'upcoming'
  if (now <= activeEnd) return 'active'
  if (now <= expiry)    return 'grace'
  return 'missed'
}

/**
 * Seconds until next status change (for countdown timer)
 */
export function secondsUntilChange(task, status) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const expiryStr = task.expiry_time || task.start_time
  const targets = {
    upcoming: new Date(`${today}T${task.start_time}`),
    active:   expiryStr ? new Date(`${today}T${expiryStr}`) : null,
    grace:    expiryStr ? new Date(`${today}T${expiryStr}`) : null,
  }

  const target = targets[status]
  if (!target) return null
  return Math.max(0, Math.round((target - now) / 1000))
}

export function formatCoins(n) {
  if (n >= 1000) return `${(n/1000).toFixed(1)}k`
  return n.toString()
}

export function coinsToLevel(totalCoins) {
  const levels = [
    { min: 0,    label: 'Rookie',   emoji: '🌱', color: '#94a3b8' },
    { min: 200,  label: 'Explorer', emoji: '🚀', color: '#4f8ef7' },
    { min: 600,  label: 'Warrior',  emoji: '⚔️',  color: '#a855f7' },
    { min: 1200, label: 'Champion', emoji: '🏆', color: '#f5c518' },
    { min: 2500, label: 'Legend',   emoji: '👑', color: '#f97316' },
  ]
  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalCoins >= levels[i].min) return { ...levels[i], next: levels[i+1] || null }
  }
  return levels[0]
}

export function formatTime(timeStr) {
  if (!timeStr) return ''
  // "08:30:00" → "8:30 AM"
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`
}

export function formatCountdown(seconds) {
  if (seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h ${m%60}m`
  }
  return `${m}:${String(s).padStart(2,'0')}`
}
