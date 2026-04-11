import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ScoreRing from './ScoreRing'
import { AnimatedBar } from './AnimatedNumber'

const TABS = ['Overview', 'Keywords', 'Skills', 'Explain', 'Roadmap']

function ScoreRow({ label, value, color, delay = 0 }) {
  const pct = Math.round((value || 0) * 100)
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-500 text-ink-600 font-body">{label}</span>
        <span className="font-mono text-sm font-700" style={{ color }}>{pct}%</span>
      </div>
      <AnimatedBar value={pct} color={color} delay={delay} height={8}/>
    </div>
  )
}

function Chip({ word, matched }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-500 border m-0.5
      ${matched
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-rose-50 border-rose-200 text-rose-600 line-through opacity-70'
      }`}>
      {matched ? '✓' : '✕'} {word}
    </span>
  )
}

function ExplainCard({ section, index }) {
  const pct = Math.round((section.score || 0) * 100)
  const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#6366F1' : pct >= 40 ? '#F59E0B' : '#F43F5E'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="card p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-600 text-sm text-ink-800 font-body leading-snug">{section.section}</p>
        <span className="font-display font-700 text-lg shrink-0" style={{ color }}>{pct}%</span>
      </div>
      <AnimatedBar value={pct} color={color} delay={index * 80} height={6}/>
      <p className="text-xs text-ink-500 font-body leading-relaxed">{section.reason}</p>
      {section.suggestions?.map((s, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
          <span className="text-amber-500 mt-0.5 shrink-0">→</span><span>{s}</span>
        </div>
      ))}
    </motion.div>
  )
}

function GapCard({ gap }) {
  const impColors = {
    critical: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'badge-rose' },
    important: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'badge-amber' },
    nice_to_have: { bg: 'bg-cream-100', border: 'border-cream-300', text: 'text-ink-600', badge: 'badge-gray' },
  }
  const style = impColors[gap.importance] || impColors.nice_to_have
  return (
    <div className={`p-4 rounded-xl border ${style.bg} ${style.border} space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="font-mono font-600 text-sm capitalize text-ink-800">{gap.skill}</span>
        <span className={`badge ${style.badge} text-2xs`}>{gap.importance}</span>
      </div>
      {gap.estimated_learning_weeks && (
        <p className="text-2xs font-mono text-ink-400">⏱ ~{gap.estimated_learning_weeks} weeks to learn</p>
      )}
      {gap.learning_resources?.slice(0, 2).map((r, i) => (
        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
          className="block text-2xs text-indigo-600 hover:text-indigo-800 font-mono truncate transition-colors">
          ↗ {r.title}
        </a>
      ))}
    </div>
  )
}

export default function ATSResult({ result, jdTitle }) {
  const [activeTab, setActiveTab] = useState(0)
  if (!result) return null

  const { scores, keyword_analysis, matched_skills, missing_skills, skill_gaps, explanation, overall_assessment, strengths, weaknesses, improvement_suggestions, recommendation } = result

  const recConfig = {
    strong_match: { label: 'Strong Match', color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    good_match: { label: 'Good Match', color: '#6366F1', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
    partial_match: { label: 'Partial Match', color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    poor_match: { label: 'Poor Match', color: '#F43F5E', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  }[recommendation] || { label: 'Analyzed', color: '#6366F1', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Hero Score Card */}
      <div className={`card p-6 ${recConfig.bg} ${recConfig.border} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-mesh opacity-60 pointer-events-none"/>
        <div className="relative flex flex-col md:flex-row items-center gap-6">
          <ScoreRing score={scores.final_score} size={130} label="ATS Score"/>
          <div className="flex-1 text-center md:text-left space-y-3">
            <div>
              <span className={`badge ${recConfig.bg} ${recConfig.border} ${recConfig.text} text-sm px-4 py-1.5`}>
                ✦ {recConfig.label}
              </span>
              {jdTitle && <p className="text-xs font-mono text-ink-400 mt-2">vs. {jdTitle}</p>}
            </div>
            <p className="text-sm text-ink-600 font-body leading-relaxed max-w-lg">{overall_assessment}</p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'BERT', val: scores.bert_score, color: '#6366F1' },
                { label: 'TF-IDF', val: scores.tfidf_score, color: '#10B981' },
                { label: 'Keywords', val: keyword_analysis?.keyword_match_rate, color: '#F59E0B' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-white/80 rounded-xl p-3 text-center border border-white shadow-xs">
                  <p className="text-2xs font-mono text-ink-400 mb-1">{label}</p>
                  <p className="font-display font-700 text-lg" style={{ color }}>{Math.round((val || 0) * 100)}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar overflow-x-auto">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} className={`tab-item ${activeTab === i ? 'active' : ''}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {/* OVERVIEW */}
          {activeTab === 0 && (
            <div className="card p-6 space-y-5">
              <h3 className="font-display font-600 text-ink-800">Score Breakdown</h3>
              <div className="space-y-4">
                <ScoreRow label="BERT Semantic Similarity" value={scores.bert_score} color="#6366F1" delay={0}/>
                <ScoreRow label="TF-IDF Keyword Overlap" value={scores.tfidf_score} color="#10B981" delay={100}/>
                <ScoreRow label="Experience Relevance" value={scores.experience_score} color="#F59E0B" delay={200}/>
                <ScoreRow label="Education Match" value={scores.education_score} color="#8B5CF6" delay={300}/>
                <ScoreRow label="Skills Coverage" value={scores.skills_score} color="#0EA5E9" delay={400}/>
              </div>
              {/* Formula note */}
              <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-mono text-xs font-700">ƒ</div>
                <p className="text-xs font-mono text-indigo-700">Final Score = 0.6 × BERT + 0.4 × TF-IDF</p>
              </div>
            </div>
          )}

          {/* KEYWORDS */}
          {activeTab === 1 && (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-600 text-ink-800">Matched Keywords</h3>
                  <span className="badge-emerald">{keyword_analysis?.total_matched || matched_skills?.length || 0} found</span>
                </div>
                <div className="flex flex-wrap">
                  {(keyword_analysis?.matched_keywords || matched_skills || []).slice(0, 30).map(k => <Chip key={k} word={k} matched/>)}
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-600 text-ink-800">Missing Keywords</h3>
                  <span className="badge-rose">{(keyword_analysis?.missing_keywords || []).length} missing</span>
                </div>
                <div className="flex flex-wrap">
                  {(keyword_analysis?.missing_keywords || []).slice(0, 30).map(k => <Chip key={k} word={k} matched={false}/>)}
                </div>
              </div>
            </div>
          )}

          {/* SKILLS */}
          {activeTab === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="font-display font-600 text-ink-800 mb-4">✓ Matched Skills</h3>
                  <div className="space-y-2">
                    {(matched_skills || []).map(s => (
                      <div key={s} className="flex items-center gap-2 text-sm font-body">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <span className="text-emerald-600 text-2xs">✓</span>
                        </div>
                        <span className="text-ink-700 capitalize">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="font-display font-600 text-ink-800 mb-4">○ Missing Skills</h3>
                  <div className="space-y-2">
                    {(missing_skills || []).slice(0, 12).map(s => (
                      <div key={s} className="flex items-center gap-2 text-sm font-body">
                        <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                          <span className="text-rose-500 text-2xs">○</span>
                        </div>
                        <span className="text-ink-600 capitalize">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {skill_gaps?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-display font-600 text-ink-800 mb-4">Skill Gaps & Learning Paths</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {skill_gaps.slice(0, 9).map((g, i) => <GapCard key={i} gap={g}/>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EXPLAIN */}
          {activeTab === 3 && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(explanation || []).map((s, i) => <ExplainCard key={i} section={s} index={i}/>)}
              </div>
            </div>
          )}

          {/* ROADMAP */}
          {activeTab === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="font-display font-600 text-ink-800 mb-4">Your Strengths</h3>
                  <div className="space-y-3">
                    {(strengths || []).map((s, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-emerald-700 text-2xs font-700">✓</span>
                        </div>
                        <span className="text-sm text-ink-700 font-body leading-relaxed">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="font-display font-600 text-ink-800 mb-4">Areas to Improve</h3>
                  <div className="space-y-3">
                    {(weaknesses || []).map((w, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                        <div className="w-5 h-5 rounded-full bg-rose-200 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-rose-700 text-2xs font-700">→</span>
                        </div>
                        <span className="text-sm text-ink-700 font-body leading-relaxed">{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <h3 className="font-display font-600 text-ink-800 mb-4">Improvement Roadmap</h3>
                <div className="space-y-3">
                  {(improvement_suggestions || []).map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-4 p-3.5 bg-cream-100 rounded-xl border border-cream-200"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="font-mono text-2xs font-700 text-indigo-600">{String(i+1).padStart(2,'0')}</span>
                      </div>
                      <span className="text-sm text-ink-700 font-body leading-relaxed">{s}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
