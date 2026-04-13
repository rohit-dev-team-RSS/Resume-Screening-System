import { motion } from 'framer-motion'

// ── Skeleton loaders ──────────────────────────────────────────────────────────
export function Skeleton({ className = '', height = 20, width = '100%', radius = 12 }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ height, width, borderRadius: radius, background: '#F1F5F9' }}
    >
      <motion.div
        animate={{ x: ['-100%', '100%'] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)' }}
      />
    </div>
  )
}

export function CardSkeleton({ rows = 3 }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <Skeleton height={18} width="60%" radius={8}/>
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} height={13} width={i % 2 === 0 ? '90%' : '75%'} radius={6}/>
      ))}
    </div>
  )
}

export function GridSkeleton({ cols = 4, height = 96 }) {
  return (
    <div className={`grid grid-cols-${cols} gap-4`}>
      {[...Array(cols)].map((_, i) => <Skeleton key={i} height={height} radius={16}/>)}
    </div>
  )
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, badge, action, gradient }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {gradient ? (
        <div className="relative rounded-3xl overflow-hidden p-8 mb-6"
          style={{ background: gradient }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.35) 1px, transparent 0)', backgroundSize: '24px 24px' }}/>
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div>
              {badge && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse"/>
                  <span className="font-mono text-white/70 text-xs tracking-widest uppercase">{badge}</span>
                </div>
              )}
              <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 30, color: 'white', lineHeight: 1.2, marginBottom: 6 }}>{title}</h1>
              {subtitle && <p className="text-white/70 text-sm font-body">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            {badge && <p className="text-xs font-mono text-indigo-500 uppercase tracking-widest mb-1">{badge}</p>}
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 26, color: '#0F172A', lineHeight: 1.2 }}>{title}</h1>
            {subtitle && <p className="text-slate-400 text-sm font-body mt-1">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
    </motion.div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ icon, label, value, sub, color, bg, trend, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden cursor-default"
    >
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-8 translate-x-8"
        style={{ background: color }}/>

      <div className="relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4"
          style={{ background: bg }}>
          {icon}
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">{label}</p>
        <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 32, color, lineHeight: 1 }}>{value}</p>
        {sub && <p className="text-xs text-slate-400 font-body mt-1.5">{sub}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-mono font-bold ${trend.up ? 'text-emerald-600' : 'text-rose-500'}`}>
            <span>{trend.up ? '↑' : '↓'}</span>
            <span>{trend.label}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Floating notification ─────────────────────────────────────────────────────
export function FloatingBadge({ icon, label, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 400, damping: 20 }}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-bold font-mono shadow-sm"
      style={{ background: `${color}12`, borderColor: `${color}30`, color }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </motion.div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl border border-slate-200 p-14 flex flex-col items-center text-center gap-4"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="text-5xl"
      >
        {icon}
      </motion.div>
      <div>
        <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, color: '#1E293B', marginBottom: 6 }}>{title}</p>
        {description && <p className="text-sm text-slate-400 font-body max-w-xs">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  )
}
