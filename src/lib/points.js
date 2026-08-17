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
export function calculateCoins(task, completedAt = null) {
  const now = completedAt ? new Date(completedAt) : new Date()
  const today = now.toISOString().split('T')[0]

  const deadline = new Date(`${today}T${task.deadline_time}`)
  const expiry   = new Date(`${today}T${task.expiry_time}`)

  if (!completedAt) {
    // Not completed — penalty
    return -Math.abs(task.penalty_coins)
  }

  if (now <= deadline) {
    return task.full_coins
  }

  if (now > expiry) {
    // Completed after expiry — still 0 (or you could still give min)
    return task.min_coins
  }

  // Linear decay between deadline and expiry
  const totalWindow = expiry - deadline
  const elapsed = now - deadline
  const ratio = 1 - (elapsed / totalWindow)
  const coins = Math.round(task.min_coins + ratio * (task.full_coins - task.min_coins))
  return Math.max(coins, task.min_coins)
}

/**
 * Current task status based on time of day
 */
export function getTaskStatus(task, completedToday = false) {
  if (completedToday) return 'done'

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const start    = new Date(`${today}T${task.start_time}`)
  const deadline = new Date(`${today}T${task.deadline_time}`)
  const expiry   = new Date(`${today}T${task.expiry_time}`)

  if (now < start)    return 'upcoming'
  if (now <= deadline) return 'active'
  if (now <= expiry)  return 'grace'    // late but still doable
  return 'missed'
}

/**
 * Seconds until next status change (for countdown timer)
 */
export function secondsUntilChange(task, status) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const targets = {
    upcoming: new Date(`${today}T${task.start_time}`),
    active:   new Date(`${today}T${task.deadline_time}`),
    grace:    new Date(`${today}T${task.expiry_time}`),
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
