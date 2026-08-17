import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatCoins, coinsToLevel, formatTime, getTaskStatus, calculateCoins } from '../lib/points'
import * as XLSX from 'xlsx'

/* ─── Emoji Picker ─── */
const TASK_EMOJIS = [
  '📚','📖','✏️','📝','🔬','🔭','🎨','🖊️','📐','📏',
  '☀️','⏰','🛏️','🦷','🚿','🛁','👕','🥛','🍎','🌅',
  '🏃','💪','⚽','🏀','🎾','🚴','🏊','🤸','🧘','🥊',
  '🧹','🧺','🍽️','🗑️','🌿','🐕','🪣','🧽','🪴','🏠',
  '🥗','🍳','🥦','🍱','🥪','🧁','🧃','🥄','🌮','🍉',
  '🌙','🛌','💤','⭐','🌟','🙏','🪥','🧸','🌛','📓',
  '⭐','🏆','🎯','💎','🪙','🎁','✨','🔥','💫','❤️',
  '😊','🎵','🎮','🎬','🎲','🎭','🎸','📺','🃏','🤖',
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
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s',
        }}
        title="Pick emoji"
      >
        {value || '⭐'}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
          />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, padding: 10, marginTop: 4,
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 2, width: 296, maxHeight: 220, overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          }}>
            {TASK_EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); setOpen(false) }}
                style={{
                  fontSize: 22, padding: '5px 2px', borderRadius: 6,
                  background: value === e ? 'rgba(245,197,24,0.2)' : 'transparent',
                  border: value === e ? '1px solid rgba(245,197,24,0.4)' : '1px solid transparent',
                  cursor: 'pointer', lineHeight: 1.2,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const TABS = ['Overview', 'Approve', 'Tasks', 'Rewards', 'Message']

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
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        padding: '20px 20px 0',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Admin Dashboard</p>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>Hey {profile?.name}! 👋</h1>
          </div>
          <button onClick={logout} style={{
            fontSize: 12, color: '#475569', padding: '6px 10px',
            background: 'rgba(255,255,255,0.05)', borderRadius: 8, border: '1px solid var(--border)'
          }}>
            Switch
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 1 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', borderRadius: '10px 10px 0 0',
              background: tab === t ? 'var(--bg-primary)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : '#94a3b8',
              fontWeight: tab === t ? 700 : 500, fontSize: 14,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              position: 'relative',
            }}>
              {t}
              {t === 'Approve' && pendingCount > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  background: '#ef4444', color: 'white',
                  fontSize: 10, fontWeight: 800, width: 16, height: 16,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="scroll-y" style={{ flex: 1, padding: 16 }}>
        {tab === 'Overview' && <OverviewTab kids={kids} />}
        {tab === 'Approve' && <ApproveTab onApprove={loadPendingCount} />}
        {tab === 'Tasks' && <TasksTab kids={kids} />}
        {tab === 'Rewards' && <RewardsTab kids={kids} />}
        {tab === 'Message' && <MessageTab kids={kids} profile={profile} />}
        <div style={{ height: 60 }} />
      </div>
    </div>
  )
}

/* ─── Overview ─── */
function OverviewTab({ kids }) {
  const [kidData, setKidData] = useState([])
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadKidData() }, [kids.length])

  async function loadKidData() {
    const data = await Promise.all(kids.map(async kid => {
      const dayOfWeek = new Date().getDay()
      const { data: tasks } = await supabase.from('tasks').select('*')
        .eq('assigned_to', kid.id).eq('is_active', true).contains('days_of_week', [dayOfWeek])
      const { data: comps } = await supabase.from('task_completions').select('*')
        .eq('kid_id', kid.id).eq('scheduled_date', today)
      return { ...kid, tasks: tasks || [], completions: comps || [] }
    }))
    setKidData(data)
  }

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Today's Overview</h2>
      {kidData.map(kid => {
        const level = coinsToLevel(kid.coin_balance || 0)
        const done = kid.completions.length
        const total = kid.tasks.length
        const pending = kid.completions.filter(c => c.status === 'pending_approval').length

        return (
          <div key={kid.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: kid.avatar_color || '#4f8ef7',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>
                {kid.avatar_emoji || '😊'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{kid.name}</div>
                <div style={{ color: '#f5c518', fontSize: 14 }}>
                  {level.emoji} {level.label} · 🪙 {formatCoins(kid.coin_balance || 0)}
                </div>
              </div>
              {pending > 0 && (
                <span style={{
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)',
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700
                }}>
                  {pending} pending
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{
                flex: 1, height: 10, background: 'rgba(255,255,255,0.08)',
                borderRadius: 5, overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%', borderRadius: 5,
                  width: total > 0 ? `${(done/total)*100}%` : '0%',
                  background: done === total && total > 0 ? '#22c55e' : 'linear-gradient(90deg, #4f8ef7, #a855f7)',
                  transition: 'width 0.5s',
                }} />
              </div>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>{done}/{total}</span>
            </div>

            {/* Task summary */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {kid.tasks.map(task => {
                const comp = kid.completions.find(c => c.task_id === task.id)
                const status = comp ? 'done' : getTaskStatus(task)
                const colors = {
                  done: '#22c55e', active: '#f5c518', grace: '#f97316',
                  missed: '#ef4444', upcoming: '#475569'
                }
                return (
                  <span key={task.id} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12,
                    background: `${colors[status]}20`,
                    color: colors[status], border: `1px solid ${colors[status]}40`
                  }}>
                    {task.icon} {task.name}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Approve ─── */
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

  async function approve(comp, adjustedCoins) {
    await supabase.from('task_completions').update({
      status: 'approved',
      coins_earned: adjustedCoins,
    }).eq('id', comp.id)

    await supabase.from('coin_transactions').insert({
      kid_id: comp.kid_id,
      amount: adjustedCoins,
      reason: `Approved: ${comp.task?.name}`,
      transaction_type: 'task_reward',
      reference_id: comp.id,
    })

    const { data: kid } = await supabase.from('profiles').select('coin_balance').eq('id', comp.kid_id).single()
    await supabase.from('profiles').update({
      coin_balance: Math.max(0, (kid?.coin_balance || 0) + adjustedCoins)
    }).eq('id', comp.kid_id)

    loadQueue()
    onApprove()
  }

  async function reject(comp) {
    await supabase.from('task_completions').update({ status: 'rejected' }).eq('id', comp.id)
    loadQueue()
    onApprove()
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

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: comp.kid?.avatar_color || '#4f8ef7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>
          {comp.kid?.avatar_emoji || '😊'}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>{comp.kid?.name}</div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            {comp.task?.icon} {comp.task?.name}
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            Completion #{comp.completion_count} ·{' '}
            {new Date(comp.completed_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Coin adjuster */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Coins to award</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setCoins(c => Math.max(0, c-5))} style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(255,255,255,0.08)', fontSize: 18, color: 'white'
          }}>−</button>
          <div style={{
            flex: 1, textAlign: 'center', fontSize: 24, fontWeight: 800, color: '#f5c518'
          }}>
            🪙 {coins}
          </div>
          <button onClick={() => setCoins(c => c+5)} style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(255,255,255,0.08)', fontSize: 18, color: 'white'
          }}>+</button>
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

      <input
        className="input-field"
        placeholder="Add a note (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
        style={{ marginBottom: 12, fontSize: 14 }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onReject(comp)} className="btn btn-danger" style={{ flex: 1 }}>
          Reject
        </button>
        <button onClick={() => onApprove(comp, coins)} className="btn btn-success" style={{ flex: 2 }}>
          Approve 🪙 {coins}
        </button>
      </div>
    </div>
  )
}

/* ─── Tasks ─── */
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function TasksTab({ kids }) {
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef(null)

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    const { data } = await supabase.from('tasks')
      .select('*, kid:assigned_to(name, avatar_emoji)')
      .neq('is_active', false)
      .order('start_time')
    setTasks(data || [])
  }

  async function saveTask(task) {
    if (task.id) {
      await supabase.from('tasks').update({ ...task, is_active: true }).eq('id', task.id)
    } else {
      await supabase.from('tasks').insert({ ...task, is_active: true })
    }
    setForm(null)
    loadTasks()
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return
    const { error } = await supabase.from('tasks').update({ is_active: false }).eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); return }
    loadTasks()
  }

  async function exportToExcel() {
    const rows = tasks.map(t => ({
      name: t.name,
      icon: t.icon,
      assigned_to: t.kid?.name || '',
      days: (t.days_of_week || []).map(d => DAY_NAMES[d]).join(','),
      start_time: t.start_time,
      deadline_time: t.deadline_time,
      expiry_time: t.expiry_time,
      full_coins: t.full_coins,
      min_coins: t.min_coins,
      penalty_coins: t.penalty_coins,
      approval_every: t.requires_approval_every,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Set column widths
    ws['!cols'] = [20,8,14,20,12,16,14,12,10,14,16].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks')
    XLSX.writeFile(wb, 'kids-karma-tasks.xlsx')
  }

  async function importFromExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws)
      let imported = 0, skipped = 0
      for (const row of rows) {
        const kid = kids.find(k => k.name.toLowerCase() === (row.assigned_to || '').toLowerCase())
        if (!kid || !row.name) { skipped++; continue }
        const days = String(row.days || '').split(',')
          .map(d => DAY_NAMES.indexOf(d.trim()))
          .filter(d => d >= 0)
        await supabase.from('tasks').insert({
          name: String(row.name),
          icon: String(row.icon || '⭐'),
          assigned_to: kid.id,
          days_of_week: days,
          start_time: String(row.start_time || '07:00'),
          deadline_time: String(row.deadline_time || '07:30'),
          expiry_time: String(row.expiry_time || '08:00'),
          full_coins: parseInt(row.full_coins) || 20,
          min_coins: parseInt(row.min_coins) || 5,
          penalty_coins: parseInt(row.penalty_coins) || 10,
          requires_approval_every: parseInt(row.approval_every) || 3,
          is_active: true,
        })
        imported++
      }
      alert(`✅ Imported ${imported} task${imported !== 1 ? 's' : ''}${skipped ? ` (${skipped} skipped — unknown kid name)` : ''}.`)
      loadTasks()
    } catch (err) {
      alert('Import failed: ' + err.message)
    }
    setImporting(false)
    e.target.value = ''
  }

  if (form !== null) return (
    <TaskForm
      task={form}
      kids={kids}
      onSave={saveTask}
      onCancel={() => setForm(null)}
    />
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ fontWeight: 700 }}>Tasks</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {tasks.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm(`Delete all ${tasks.length} tasks? This cannot be undone.`)) return
                const { error } = await supabase.from('tasks').update({ is_active: false }).not('id', 'is', null)
                if (error) { alert('Clear All failed: ' + error.message); return }
                loadTasks()
              }}
              style={{
                padding: '10px 18px', fontSize: 14, borderRadius: 10,
                background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontWeight: 600,
              }}
            >
              🗑 Clear All
            </button>
          )}
          <button onClick={() => setForm({})} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 14 }}>
            + New Task
          </button>
        </div>
      </div>

      {/* Excel import/export bar */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16,
        padding: '10px 14px', borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, color: '#94a3b8', flex: 1 }}>📊 Excel</span>
        <button
          onClick={exportToExcel}
          disabled={tasks.length === 0}
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13,
            background: 'rgba(34,197,94,0.12)', color: '#22c55e',
            border: '1px solid rgba(34,197,94,0.25)', cursor: 'pointer',
          }}
        >
          ↓ Export
        </button>
        <button
          onClick={() => importRef.current?.click()}
          disabled={importing}
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13,
            background: 'rgba(79,142,247,0.12)', color: '#4f8ef7',
            border: '1px solid rgba(79,142,247,0.25)', cursor: 'pointer',
          }}
        >
          {importing ? 'Importing…' : '↑ Import'}
        </button>
        <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importFromExcel} />
      </div>

      {tasks.map(task => (
        <div key={task.id} className="card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>{task.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{task.name}</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              {task.kid?.avatar_emoji} {task.kid?.name} · {formatTime(task.start_time)} → {formatTime(task.deadline_time)}
            </div>
            <div style={{ fontSize: 12, color: '#f5c518', marginTop: 2 }}>
              🪙 {task.full_coins} full · {task.min_coins} min · −{task.penalty_coins} penalty
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setForm(task)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 13,
              background: 'rgba(255,255,255,0.06)', color: '#94a3b8'
            }}>Edit</button>
            <button onClick={() => deleteTask(task.id)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 13,
              background: 'rgba(239,68,68,0.1)', color: '#ef4444'
            }}>Del</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function TaskForm({ task, kids, onSave, onCancel }) {
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const [form, setForm] = useState({
    name: task.name || '',
    icon: task.icon || '⭐',
    description: task.description || '',
    assigned_to: task.assigned_to || kids[0]?.id || '',
    days_of_week: task.days_of_week || [1,2,3,4,5],
    start_time: task.start_time || '07:00',
    deadline_time: task.deadline_time || '07:30',
    expiry_time: task.expiry_time || '08:00',
    full_coins: task.full_coins || 20,
    min_coins: task.min_coins || 5,
    penalty_coins: task.penalty_coins || 10,
    requires_approval_every: task.requires_approval_every || 3,
    id: task.id,
  })

  function toggleDay(d) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter(x => x !== d)
        : [...f.days_of_week, d]
    }))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontWeight: 700 }}>{form.id ? 'Edit Task' : 'New Task'}</h2>
        <button onClick={onCancel} style={{ color: '#94a3b8', fontSize: 14 }}>Cancel</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Row label="Icon & Name">
          <div style={{ display: 'flex', gap: 8 }}>
            <EmojiPicker value={form.icon} onChange={emoji => setForm(f=>({...f,icon:emoji}))} />
            <input className="input-field" value={form.name} placeholder="Task name" onChange={e => setForm(f=>({...f,name:e.target.value}))} style={{ flex: 1 }} />
          </div>
        </Row>

        <Row label="Assigned to">
          <select className="input-field" value={form.assigned_to} onChange={e => setForm(f=>({...f,assigned_to:e.target.value}))}>
            {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </Row>

        <Row label="Days">
          <div style={{ display: 'flex', gap: 6 }}>
            {DAYS.map((d,i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: form.days_of_week.includes(i) ? 'rgba(79,142,247,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${form.days_of_week.includes(i) ? 'rgba(79,142,247,0.5)' : 'var(--border)'}`,
                color: form.days_of_week.includes(i) ? '#4f8ef7' : '#94a3b8',
              }}>{d}</button>
            ))}
          </div>
        </Row>

        <Row label="Start time">
          <input type="time" className="input-field" value={form.start_time} onChange={e => setForm(f=>({...f,start_time:e.target.value}))} />
        </Row>
        <Row label="Full coins deadline">
          <input type="time" className="input-field" value={form.deadline_time} onChange={e => setForm(f=>({...f,deadline_time:e.target.value}))} />
        </Row>
        <Row label="Task expires (missed)">
          <input type="time" className="input-field" value={form.expiry_time} onChange={e => setForm(f=>({...f,expiry_time:e.target.value}))} />
        </Row>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: '🪙 Full coins', key: 'full_coins' },
            { label: '🪙 Min coins', key: 'min_coins' },
            { label: '❌ Penalty', key: 'penalty_coins' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>{label}</label>
              <input type="number" className="input-field" value={form[key]} min={0}
                onChange={e => setForm(f=>({...f,[key]:parseInt(e.target.value)||0}))} />
            </div>
          ))}
        </div>

        <Row label="Approval every N completions">
          <input type="number" className="input-field" value={form.requires_approval_every} min={1}
            onChange={e => setForm(f=>({...f,requires_approval_every:parseInt(e.target.value)||3}))} />
        </Row>

        <button onClick={() => onSave(form)} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }}>
          {form.id ? 'Save Changes' : 'Create Task'}
        </button>
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

/* ─── Rewards ─── */
function RewardsTab({ kids }) {
  const [rewards, setRewards] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', icon:'🎁', coin_cost:100, description:'' })

  useEffect(() => { loadRewards(); loadRedemptions() }, [])

  async function loadRewards() {
    const { data } = await supabase.from('rewards').select('*').eq('is_active', true)
    setRewards(data || [])
  }

  async function loadRedemptions() {
    const { data } = await supabase
      .from('reward_redemptions')
      .select('*, kid:kid_id(name, avatar_emoji), reward:reward_id(name, icon)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRedemptions(data || [])
  }

  async function saveReward() {
    await supabase.from('rewards').insert(form)
    setShowForm(false)
    setForm({ name:'', icon:'🎁', coin_cost:100, description:'' })
    loadRewards()
  }

  async function approveRedemption(r) {
    await supabase.from('reward_redemptions').update({ status:'approved' }).eq('id', r.id)
    loadRedemptions()
  }

  async function rejectRedemption(r) {
    // Refund coins
    await supabase.from('coin_transactions').insert({
      kid_id: r.kid_id, amount: r.coins_spent,
      reason: `Refund: ${r.reward?.name}`, transaction_type: 'adjustment'
    })
    const { data: kid } = await supabase.from('profiles').select('coin_balance').eq('id', r.kid_id).single()
    await supabase.from('profiles').update({ coin_balance: (kid?.coin_balance||0) + r.coins_spent }).eq('id', r.kid_id)
    await supabase.from('reward_redemptions').update({ status:'rejected' }).eq('id', r.id)
    loadRedemptions()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontWeight: 700 }}>Rewards</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 14 }}>
          + New Reward
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <EmojiPicker value={form.icon} onChange={emoji=>setForm(f=>({...f,icon:emoji}))} />
            <input className="input-field" value={form.name} placeholder="Reward name" onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{ flex:1 }} />
          </div>
          <input className="input-field" value={form.description} placeholder="Description (optional)" onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{ marginBottom:10 }} />
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <span style={{ color:'#f5c518', fontSize:16 }}>🪙 Cost:</span>
            <input type="number" className="input-field" value={form.coin_cost} style={{ width:100 }} onChange={e=>setForm(f=>({...f,coin_cost:parseInt(e.target.value)||0}))} />
          </div>
          <button onClick={saveReward} className="btn btn-primary" style={{ width:'100%' }}>Save Reward</button>
        </div>
      )}

      {redemptions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontWeight: 600, color: '#f97316', marginBottom: 10 }}>⏳ Pending Redemptions</h3>
          {redemptions.map(r => (
            <div key={r.id} className="card" style={{ marginBottom: 8, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <span style={{ fontWeight:700 }}>{r.kid?.avatar_emoji} {r.kid?.name}</span>
                  <span style={{ color:'#94a3b8', marginLeft:8 }}>wants {r.reward?.icon} {r.reward?.name}</span>
                  <div style={{ fontSize:13, color:'#f5c518', marginTop:4 }}>🪙 {r.coins_spent} coins</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => rejectRedemption(r)} className="btn btn-danger" style={{ padding:'8px 14px', fontSize:13 }}>Deny</button>
                  <button onClick={() => approveRedemption(r)} className="btn btn-success" style={{ padding:'8px 14px', fontSize:13 }}>Give</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontWeight: 600, marginBottom: 10, color: '#94a3b8' }}>Available Rewards</h3>
      {rewards.map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 8, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:28 }}>{r.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600 }}>{r.name}</div>
            {r.description && <div style={{ fontSize:13, color:'#94a3b8' }}>{r.description}</div>}
          </div>
          <div style={{ color:'#f5c518', fontWeight:700 }}>🪙 {r.coin_cost}</div>
        </div>
      ))}
    </div>
  )
}

/* ─── Message ─── */
function MessageTab({ kids, profile }) {
  const [to, setTo] = useState(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  async function send() {
    if (!text.trim()) return
    await supabase.from('messages').insert({
      from_id: profile.id,
      to_id: to || null,
      content: text.trim(),
    })
    setText('')
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  return (
    <div>
      <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Send a Message</h2>
      <div className="card">
        <Row label="To">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => setTo(null)} style={{
              padding:'8px 16px', borderRadius:20, fontSize:14, fontWeight:600,
              background: to === null ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${to === null ? 'rgba(245,197,24,0.5)' : 'var(--border)'}`,
              color: to === null ? '#f5c518' : '#94a3b8',
            }}>All kids</button>
            {kids.map(k => (
              <button key={k.id} onClick={() => setTo(k.id)} style={{
                padding:'8px 16px', borderRadius:20, fontSize:14, fontWeight:600,
                background: to === k.id ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${to === k.id ? 'rgba(245,197,24,0.5)' : 'var(--border)'}`,
                color: to === k.id ? '#f5c518' : '#94a3b8',
              }}>
                {k.avatar_emoji} {k.name}
              </button>
            ))}
          </div>
        </Row>

        <div style={{ marginTop: 14 }}>
          <textarea
            className="input-field"
            placeholder="Type your message..."
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 14, width: '100%', resize: 'none', fontSize: 15
            }}
          />
        </div>

        <button onClick={send} disabled={!text.trim()} className="btn btn-primary" style={{ width:'100%', marginTop:12 }}>
          {sent ? '✅ Sent!' : '📨 Send Message'}
        </button>
      </div>
    </div>
  )
}
