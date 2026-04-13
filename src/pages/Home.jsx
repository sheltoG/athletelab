import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getSetting, setSetting } from '../db';
import './Home.css';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDaysOfWeek() {
  const monday = getWeekStart();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export default function Home() {
  const navigate = useNavigate();
  const [sessionsThisWeek, setSessionsThisWeek] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [trackedTemplates, setTrackedTemplates] = useState({});
  const [today] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const days = getDaysOfWeek();

  const load = useCallback(async () => {
    const tracked = await getSetting('trackedTemplates');
    setTrackedTemplates(tracked ?? {});

    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const sessions = await db.workoutSessions
      .where('date')
      .between(weekStart.getTime(), weekEnd.getTime())
      .toArray();
    setSessionsThisWeek(sessions);

    const recent = await db.workoutSessions
      .orderBy('date')
      .reverse()
      .limit(5)
      .toArray();
    setRecentSessions(recent);

    const tmpl = await db.workoutTemplates.toArray();
    setTemplates(tmpl);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteSession = useCallback(async (id) => {
    await db.workoutSessions.delete(id);
    load();
  }, [load]);

  // Count completions per templateId this week
  const templateCounts = {};
  for (const s of sessionsThisWeek) {
    if (s.templateId != null) {
      const key = String(s.templateId);
      templateCounts[key] = (templateCounts[key] || 0) + 1;
    }
  }

  const trackedEntries = Object.entries(trackedTemplates);

  return (
    <div className="page">
      <div className="page-content">
        <header className="home-header">
          <div className="home-header__week">
            <span className="home-header__week-label">{formatWeekRange(days[0], days[6])}</span>
          </div>
          <h1 className="home-header__title">AthleteLab</h1>
          <button className="btn btn--ghost btn--icon" onClick={() => setShowSettings(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </header>

        {/* Week dots */}
        <div className="week-dots card">
          {days.map((day, i) => {
            const hasSession = sessionsThisWeek.some(s => isSameDay(new Date(s.date), day));
            const isToday = isSameDay(day, today);
            const isPast = day < today && !isToday;
            return (
              <div key={i} className="week-dots__day">
                <div className={`week-dots__dot
                  ${hasSession ? 'week-dots__dot--done' : ''}
                  ${isToday ? 'week-dots__dot--today' : ''}
                  ${isPast && !hasSession ? 'week-dots__dot--missed' : ''}
                `} />
                <span className={`week-dots__label ${isToday ? 'week-dots__label--today' : ''}`}>
                  {DAY_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Weekly progress — template based */}
        <div className="card training-score-card">
          <div className="training-score-card__header">
            <span className="training-score-card__title">Weekly Progress</span>
          </div>
          {trackedEntries.length === 0 && (
            <p className="training-score-card__hint">Select templates to track in Settings.</p>
          )}
          {trackedEntries.map(([templateId, goal]) => {
            const tmpl = templates.find(t => String(t.id) === String(templateId));
            const name = tmpl?.name ?? 'Unknown Template';
            const count = templateCounts[String(templateId)] || 0;
            const pct = Math.min(100, (count / goal) * 100);
            const done = count >= goal;
            return (
              <div key={templateId} className="category-progress-row">
                <div className="category-progress-row__top">
                  <span className="category-progress-row__label">{name}</span>
                  <span className={`category-progress-row__count ${done ? 'category-progress-row__count--done' : ''}`}>
                    {count} / {goal}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-bar__fill ${done ? 'progress-bar__fill--done' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Today section */}
        <div className="home-today">
          <p className="home-today__date">{formatDate(today)}</p>
          <button className="btn btn--primary btn--full home-start-btn" onClick={() => setShowTemplateSelect(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Start Workout
          </button>
        </div>

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <div className="home-recent">
            <h3 className="home-section-title">Recent Workouts</h3>
            {recentSessions.map(s => (
              <RecentSessionRow
                key={s.id}
                session={s}
                onDelete={() => deleteSession(s.id)}
                onSelect={() => setSelectedSession(s)}
              />
            ))}
          </div>
        )}
      </div>

      {showTemplateSelect && (
        <TemplateSelectSheet
          templates={templates}
          onBlank={() => { setShowTemplateSelect(false); navigate('/workout'); }}
          onTemplate={(id) => { setShowTemplateSelect(false); navigate('/workout', { state: { templateId: id } }); }}
          onClose={() => setShowTemplateSelect(false)}
        />
      )}

      {showSettings && (
        <SettingsSheet
          templates={templates}
          trackedTemplates={trackedTemplates}
          onSave={async ({ restSec, newTracked }) => {
            await setSetting('defaultRestTimerSeconds', restSec);
            await setSetting('trackedTemplates', newTracked);
            setTrackedTemplates(newTracked);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {selectedSession && (
        <WorkoutDetailSheet
          session={selectedSession}
          templates={templates}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}

// ─── Template select sheet ───────────────────────────────────────────────────
function TemplateSelectSheet({ templates, onBlank, onTemplate, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__title">Start Workout</div>

        <button className="btn btn--primary btn--full" style={{ marginBottom: 16 }} onClick={onBlank}>
          Blank Workout
        </button>

        {templates.length > 0 && (
          <>
            <div className="template-select__label">Or choose a template</div>
            <div className="template-select__list">
              {templates.map(t => (
                <button key={t.id} className="template-select__item" onClick={() => onTemplate(t.id)}>
                  <div className="template-select__item-name">{t.name}</div>
                  <div className="template-select__item-meta">
                    {t.exercises?.length ?? 0} exercise{(t.exercises?.length ?? 0) !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <button className="btn btn--ghost btn--full" style={{ marginTop: 12 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Settings sheet ──────────────────────────────────────────────────────────
function GoalPicker({ value, onChange }) {
  const opts = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
      {opts.map(n => (
        <button
          key={n}
          className={`chip ${value === n ? 'active' : ''}`}
          onClick={() => onChange(n)}
          style={{ flex: '1 0 auto', justifyContent: 'center', padding: '7px 0', minWidth: 36, fontSize: 12 }}
        >
          {n}×
        </button>
      ))}
    </div>
  );
}

function SettingsSheet({ templates, trackedTemplates, onSave, onClose }) {
  const [restSec, setRestSec] = useState(30);
  const [newTracked, setNewTracked] = useState({ ...trackedTemplates });

  useEffect(() => {
    getSetting('defaultRestTimerSeconds').then(v => { if (v != null) setRestSec(v); });
  }, []);

  const toggleTemplate = (id) => {
    const key = String(id);
    if (newTracked[key]) {
      const next = { ...newTracked };
      delete next[key];
      setNewTracked(next);
    } else {
      setNewTracked(prev => ({ ...prev, [key]: 2 }));
    }
  };

  const setGoal = (id, goal) => {
    setNewTracked(prev => ({ ...prev, [String(id)]: goal }));
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__title">Settings</div>

        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Default Rest Timer
        </label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[30, 45, 60].map(s => (
            <button
              key={s}
              className={`chip ${restSec === s ? 'active' : ''}`}
              onClick={() => setRestSec(s)}
              style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>

        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Weekly Template Goals
        </label>

        {templates.length === 0 && (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 20 }}>
            No templates yet. Create one in the Plan tab.
          </p>
        )}

        {templates.map(t => {
          const key = String(t.id);
          const isTracked = !!newTracked[key];
          return (
            <div key={t.id} className="settings-template-row">
              <div className="settings-template-row__top">
                <span className="settings-template-row__name">{t.name}</span>
                <button
                  className={`chip ${isTracked ? 'active' : ''}`}
                  onClick={() => toggleTemplate(t.id)}
                  style={{ padding: '5px 12px', fontSize: 12 }}
                >
                  {isTracked ? 'Tracking' : 'Track'}
                </button>
              </div>
              {isTracked && (
                <GoalPicker value={newTracked[key]} onChange={goal => setGoal(t.id, goal)} />
              )}
            </div>
          );
        })}

        <button
          className="btn btn--primary btn--full"
          onClick={() => onSave({ restSec, newTracked })}
          style={{ marginTop: 20, marginBottom: 10 }}
        >
          Save Settings
        </button>
        <button className="btn btn--ghost btn--full" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Workout detail sheet ────────────────────────────────────────────────────
function WorkoutDetailSheet({ session, templates, onClose }) {
  const tmpl = session.templateId
    ? templates.find(t => t.id === session.templateId)
    : null;
  const date = new Date(session.date);
  const typeLabel = session.workoutType
    ? session.workoutType.charAt(0).toUpperCase() + session.workoutType.slice(1)
    : 'Workout';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" style={{ maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="workout-detail__header">
          <div className="workout-detail__title">{tmpl?.name ?? typeLabel}</div>
          <div className="workout-detail__meta">
            {formatDate(date)} · {formatDuration(session.duration)}
          </div>
        </div>

        {(session.exercises || []).map((ex, i) => (
          <div key={i} className="workout-detail__exercise">
            <div className="workout-detail__ex-name">{ex.exerciseName}</div>
            {(ex.sets || []).map((set, j) => (
              <div key={j} className={`workout-detail__set ${!set.completed ? 'workout-detail__set--skipped' : ''}`}>
                <span className="workout-detail__set-num">Set {j + 1}</span>
                <span className="workout-detail__set-data">
                  {ex.isIsometric
                    ? `${set.weight ? `${set.weight} lbs · ` : ''}${set.holdTime ? `${set.holdTime}s` : '–'}`
                    : `${set.weight ? `${set.weight} lbs` : 'BW'} × ${set.reps || '–'}`
                  }
                </span>
                {set.completed && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            ))}
          </div>
        ))}

        <button className="btn btn--ghost btn--full" style={{ marginTop: 16 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ─── Recent session row ──────────────────────────────────────────────────────
function RecentSessionRow({ session, onDelete, onSelect }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const exerciseCount = session.exercises?.length ?? 0;
  const setCount = session.exercises?.reduce((a, e) => a + (e.sets?.length ?? 0), 0) ?? 0;
  const date = new Date(session.date);
  const duration = session.duration ?? 0;
  const typeLabel = session.workoutType && session.workoutType !== 'workout'
    ? ` · ${session.workoutType}`
    : '';

  return (
    <div className="card--flat recent-row">
      <button className="recent-row__info" onClick={onSelect}>
        <span className="recent-row__date">{formatDate(date)}{typeLabel}</span>
        <span className="recent-row__meta">{exerciseCount} exercises · {setCount} sets · {formatDuration(duration)}</span>
      </button>
      {confirmDelete ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn--danger btn--sm" onClick={onDelete}>Delete</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>No</button>
        </div>
      ) : (
        <button className="btn btn--ghost btn--icon" onClick={() => setConfirmDelete(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      )}
    </div>
  );
}

function formatWeekRange(start, end) {
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatDuration(ms) {
  if (!ms) return '–';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}h ${rem}m` : `${m}m`;
}
