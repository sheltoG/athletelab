import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import './Plan.css';

export default function Plan() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('templates'); // 'templates' | 'cycles'
  const [templates, setTemplates] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [editingCycle, setEditingCycle] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setTemplates(await db.workoutTemplates.toArray());
    setCycles(await db.trainingCycles.orderBy('startDate').reverse().toArray());
  }

  const deleteTemplate = async (id) => {
    await db.workoutTemplates.delete(id);
    loadData();
  };

  const deleteCycle = async (id) => {
    await db.trainingCycles.delete(id);
    loadData();
  };

  return (
    <div className="page">
      <div className="page-content">
        <h2 className="plan-title">Plan</h2>

        {/* Tab toggle */}
        <div className="plan-tabs">
          <button className={`plan-tab ${tab === 'templates' ? 'plan-tab--active' : ''}`} onClick={() => setTab('templates')}>
            Your Templates
          </button>
          <button className={`plan-tab ${tab === 'cycles' ? 'plan-tab--active' : ''}`} onClick={() => setTab('cycles')}>
            Training Cycles
          </button>
        </div>

        {tab === 'templates' && (
          <>
            <button className="btn btn--primary btn--full" onClick={() => navigate('/template/new')}>
              + New Template
            </button>
            <div style={{ marginTop: 16 }}>
              {templates.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">📋</div>
                  <div className="empty-state__title">No Templates</div>
                  <div className="empty-state__subtitle">Create your first workout template.</div>
                </div>
              ) : templates.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onEdit={() => navigate(`/template/${t.id}`)}
                  onDelete={() => deleteTemplate(t.id)}
                />
              ))}
            </div>
          </>
        )}

        {tab === 'cycles' && (
          <>
            <button className="btn btn--primary btn--full" onClick={() => { setEditingCycle(null); setShowCycleForm(true); }}>
              + New Cycle
            </button>
            <div style={{ marginTop: 16 }}>
              {cycles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">🔄</div>
                  <div className="empty-state__title">No Training Cycles</div>
                  <div className="empty-state__subtitle">Create a 4-week training block tied to a template.</div>
                </div>
              ) : cycles.map(c => (
                <CycleCard
                  key={c.id}
                  cycle={c}
                  templates={templates}
                  onEdit={() => { setEditingCycle(c); setShowCycleForm(true); }}
                  onDelete={() => deleteCycle(c.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showCycleForm && (
        <CycleForm
          cycle={editingCycle}
          templates={templates}
          onSave={() => { setShowCycleForm(false); loadData(); }}
          onClose={() => setShowCycleForm(false)}
        />
      )}
    </div>
  );
}

// ─── Template card ──────────────────────────────────────────────────────────────
function TemplateCard({ template, onEdit, onDelete }) {
  const exerciseCount = template.exercises?.length ?? 0;
  return (
    <div className="card template-card">
      <div className="template-card__row">
        <div>
          <div className="template-card__name">{template.name}</div>
          <div className="template-card__meta">
            {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
            {template.workoutType && template.workoutType !== 'workout' && (
              <span className="template-card__type-badge"> · {template.workoutType}</span>
            )}
            {template.format === 'superset' && (
              <span className="template-card__type-badge"> · superset</span>
            )}
          </div>
        </div>
        <div className="template-card__actions">
          <button className="btn btn--ghost btn--icon" onClick={onEdit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button className="btn btn--ghost btn--icon" onClick={onDelete}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>
      {template.exercises?.length > 0 && (
        <div className="template-exercises">
          {template.exercises.map((e, i) => (
            <span key={i} className="template-ex-chip">{e.exerciseName}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Cycle card ─────────────────────────────────────────────────────────────────
function CycleCard({ cycle, templates, onEdit, onDelete }) {
  const [exerciseBests, setExerciseBests] = useState({});

  const start = new Date(cycle.startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 27);
  const endMs = end.getTime() + 24 * 3600 * 1000;
  const today = new Date();
  const weekNum = Math.min(4, Math.max(1, Math.ceil((today - start) / (7 * 24 * 3600 * 1000))));
  const isActive = today >= start && today <= end;
  const templateName = cycle.templateId
    ? templates.find(t => t.id === cycle.templateId)?.name
    : null;

  // Load best weights for each exercise in this cycle's date range
  useEffect(() => {
    if (!cycle.goals?.length) return;
    db.workoutSessions
      .where('date').between(cycle.startDate, endMs)
      .toArray()
      .then(sessions => {
        const bests = {};
        for (const session of sessions) {
          for (const entry of (session.exercises || [])) {
            for (const set of (entry.sets || [])) {
              if (set.completed && set.weight) {
                const w = Number(set.weight);
                if (!bests[entry.exerciseId] || w > bests[entry.exerciseId]) {
                  bests[entry.exerciseId] = w;
                }
              }
            }
          }
        }
        setExerciseBests(bests);
      });
  }, [cycle.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const goalsWithTargets = (cycle.goals || []).filter(g => g.targetWeight);

  return (
    <div className="card cycle-card">
      <div className="cycle-card__row">
        <div>
          <div className="cycle-card__name">{cycle.name}</div>
          <div className="cycle-card__dates">
            {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
            {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {templateName && (
            <div className="cycle-card__template-tag">{templateName}</div>
          )}
        </div>
        <div className="template-card__actions">
          <button className="btn btn--ghost btn--icon" onClick={onEdit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button className="btn btn--ghost btn--icon" onClick={onDelete}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Week progress bar */}
      {isActive && (
        <div className="cycle-week-row">
          {[1, 2, 3, 4].map(w => (
            <div key={w} className={`cycle-week ${w < weekNum ? 'cycle-week--done' : ''} ${w === weekNum ? 'cycle-week--current' : ''}`}>
              W{w}
            </div>
          ))}
        </div>
      )}

      {/* Exercise goals with live progress */}
      {goalsWithTargets.length > 0 && (
        <div className="cycle-goals">
          {goalsWithTargets.map((g, i) => {
            const best = exerciseBests[g.exerciseId] ?? null;
            const start = Number(g.startWeight) || 0;
            const target = Number(g.targetWeight);
            const current = best ?? start;
            const pct = target > start
              ? Math.min(100, Math.max(0, ((current - start) / (target - start)) * 100))
              : 0;

            return (
              <div key={i} className="cycle-goal-item--display">
                <div className="cycle-goal-item__top">
                  <span className="cycle-goal-name">{g.exerciseName}</span>
                  <span className="cycle-goal-item__weights">
                    {best ? (
                      <span className="cycle-goal-item__current">{best} lbs</span>
                    ) : start ? (
                      <span className="cycle-goal-item__start">{start} lbs</span>
                    ) : null}
                    <span className="cycle-goal-item__sep"> / </span>
                    <span className="cycle-goal-item__target">{target} lbs</span>
                    {g.targetReps ? <span className="cycle-goal-item__reps"> × {g.targetReps}</span> : null}
                  </span>
                </div>
                {target > 0 && (
                  <div className="cycle-goal-bar">
                    <div className="cycle-goal-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Cycle form ──────────────────────────────────────────────────────────────────
function CycleForm({ cycle, templates, onSave, onClose }) {
  const [name, setName] = useState(cycle?.name ?? '');
  const [startDate, setStartDate] = useState(cycle?.startDate
    ? new Date(cycle.startDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(cycle?.templateId ?? null);
  const [goals, setGoals] = useState(() => {
    // Initialize goals; preserve existing if editing
    return (cycle?.goals ?? []).map(g => ({
      exerciseId: g.exerciseId,
      exerciseName: g.exerciseName,
      startWeight: g.startWeight ?? '',
      targetWeight: g.targetWeight ?? '',
      targetReps: g.targetReps ?? '',
    }));
  });
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [allExercises, setAllExercises] = useState([]);

  useEffect(() => {
    db.exercises.orderBy('name').toArray().then(setAllExercises);
  }, []);

  // When template is selected, merge its exercises into goals
  useEffect(() => {
    if (!selectedTemplateId) return;
    const tmpl = templates.find(t => t.id === selectedTemplateId);
    if (!tmpl?.exercises?.length) return;

    setGoals(prev => {
      const existingByExId = {};
      prev.forEach(g => { existingByExId[g.exerciseId] = g; });
      return tmpl.exercises.map(ex => existingByExId[ex.exerciseId] ?? {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        startWeight: '',
        targetWeight: '',
        targetReps: ex.defaultReps ?? '',
      });
    });
  }, [selectedTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateGoal = (exerciseId, field, value) => {
    setGoals(prev => prev.map(g =>
      g.exerciseId === exerciseId ? { ...g, [field]: value } : g
    ));
  };

  const removeGoal = (exerciseId) => {
    setGoals(prev => prev.filter(g => g.exerciseId !== exerciseId));
  };

  const addIndividualGoal = (goal) => {
    setGoals(prev => {
      if (prev.some(g => g.exerciseId === goal.exerciseId)) return prev;
      return [...prev, goal];
    });
    setShowGoalForm(false);
  };

  const save = async () => {
    if (!name.trim()) return;
    const finalGoals = goals.map(g => {
      const startW = Number(g.startWeight) || 0;
      const targetW = Number(g.targetWeight) || 0;
      const targetR = Number(g.targetReps) || 0;
      let weeklyProgression = null;
      if (startW && targetW) {
        weeklyProgression = [0, 1, 2, 3].map(w => {
          const step = (targetW - startW) / 3;
          return Math.round((startW + step * w) * 4) / 4;
        });
        weeklyProgression[3] = targetW;
      }
      return {
        exerciseId: g.exerciseId,
        exerciseName: g.exerciseName,
        startWeight: startW,
        targetWeight: targetW,
        targetReps: targetR,
        mode: 'linear',
        weeklyProgression,
      };
    });
    const data = {
      name: name.trim(),
      startDate: new Date(startDate).getTime(),
      isActive: true,
      templateId: selectedTemplateId ?? null,
      goals: finalGoals,
    };
    if (cycle?.id) {
      await db.trainingCycles.update(cycle.id, data);
    } else {
      await db.trainingCycles.add(data);
    }
    onSave();
  };

  const selectedTemplateName = selectedTemplateId
    ? templates.find(t => t.id === selectedTemplateId)?.name
    : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet cycle-form-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__title">{cycle ? 'Edit Cycle' : 'New Training Cycle'}</div>

        <input
          className="input"
          placeholder="Cycle name (e.g. Strength Block 1)"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        <label className="cycle-form__label">Start Date</label>
        <input
          type="date"
          className="input"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          style={{ marginBottom: 16, colorScheme: 'dark' }}
        />

        {/* Template selector */}
        <label className="cycle-form__label">Training Template</label>
        {selectedTemplateName ? (
          <div className="cycle-form__template-selected">
            <span className="cycle-form__template-name">{selectedTemplateName}</span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setSelectedTemplateId(null); setGoals([]); }}
            >
              Clear
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowTemplatePicker(true)}>
              Change
            </button>
          </div>
        ) : (
          <button
            className="btn btn--secondary btn--full"
            style={{ marginBottom: 16 }}
            onClick={() => setShowTemplatePicker(true)}
          >
            Select Template
          </button>
        )}

        {/* Exercise goals */}
        {goals.length > 0 && (
          <div className="cycle-form__goals-section">
            <div className="cycle-form__goals-header">
              <span className="cycle-form__section-label">Exercise Goals</span>
              <span className="cycle-form__goals-hint">Set 4-week targets (optional)</span>
            </div>
            {goals.map(g => (
              <div key={g.exerciseId} className="cycle-goal-input-row">
                <div className="cycle-goal-input-row__header">
                  <span className="cycle-goal-input-row__name">{g.exerciseName}</span>
                  <button className="btn btn--ghost btn--icon" style={{ flexShrink: 0 }} onClick={() => removeGoal(g.exerciseId)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div className="cycle-goal-input-row__fields">
                  <div className="cycle-goal-input-row__field">
                    <label>Start (lbs)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="input"
                      placeholder="–"
                      value={g.startWeight}
                      onChange={e => updateGoal(g.exerciseId, 'startWeight', e.target.value)}
                    />
                  </div>
                  <div className="cycle-goal-input-row__arrow">→</div>
                  <div className="cycle-goal-input-row__field">
                    <label>Target (lbs)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="input"
                      placeholder="–"
                      value={g.targetWeight}
                      onChange={e => updateGoal(g.exerciseId, 'targetWeight', e.target.value)}
                    />
                  </div>
                  <div className="cycle-goal-input-row__field cycle-goal-input-row__field--reps">
                    <label>Reps</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="input"
                      placeholder="–"
                      value={g.targetReps}
                      onChange={e => updateGoal(g.exerciseId, 'targetReps', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add individual goal */}
        <button
          className="btn btn--ghost btn--sm cycle-form__add-goal-btn"
          onClick={() => setShowGoalForm(true)}
        >
          + Add individual goal
        </button>

        <div style={{ height: 16 }} />
        <button className="btn btn--primary btn--full" onClick={save} style={{ marginBottom: 10 }}>
          {cycle ? 'Save Changes' : 'Create Cycle'}
        </button>
        <button className="btn btn--ghost btn--full" onClick={onClose}>Cancel</button>

        {/* Template picker overlay */}
        {showTemplatePicker && (
          <div className="overlay" style={{ zIndex: 200 }} onClick={() => setShowTemplatePicker(false)}>
            <div className="sheet" onClick={e => e.stopPropagation()}>
              <div className="sheet__handle" />
              <div className="sheet__title">Select Template</div>
              {templates.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
                  No templates yet. Create one in the Templates tab.
                </p>
              ) : (
                <div className="exercise-list">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      className="exercise-list__item"
                      onClick={() => { setSelectedTemplateId(t.id); setShowTemplatePicker(false); }}
                    >
                      <span>{t.name}</span>
                      <span className="badge badge--category">{t.exercises?.length || 0} exercises</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Individual goal form */}
        {showGoalForm && (
          <IndividualGoalForm
            exercises={allExercises}
            onAdd={addIndividualGoal}
            onClose={() => setShowGoalForm(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Individual goal form (for goals not in a template) ─────────────────────────
function IndividualGoalForm({ exercises, onAdd, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedEx, setSelectedEx] = useState(null);
  const [targetWeight, setTargetWeight] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [startWeight, setStartWeight] = useState('');

  const filtered = exercises.filter(e =>
    !e.isIsometric && e.name.toLowerCase().includes(search.toLowerCase())
  );

  const add = () => {
    if (!selectedEx) return;
    onAdd({
      exerciseId: selectedEx.id,
      exerciseName: selectedEx.name,
      startWeight: startWeight,
      targetWeight: targetWeight,
      targetReps: targetReps,
    });
  };

  return (
    <div className="overlay" style={{ zIndex: 200 }} onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__title">Add Individual Goal</div>

        {!selectedEx ? (
          <>
            <input
              className="input"
              placeholder="Search exercise..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{ marginBottom: 8 }}
            />
            <div className="exercise-list" style={{ maxHeight: 260 }}>
              {filtered.map(ex => (
                <button key={ex.id} className="exercise-list__item" onClick={() => setSelectedEx(ex)}>
                  <span>{ex.name}</span>
                  <span className="badge badge--category">{ex.category}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{selectedEx.name}</span>
              <button className="btn btn--ghost btn--sm" onClick={() => setSelectedEx(null)}>Change</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Start (lbs)</label>
                <input className="input" type="number" placeholder="e.g. 185" value={startWeight} onChange={e => setStartWeight(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Target (lbs)</label>
                <input className="input" type="number" placeholder="e.g. 225" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Reps</label>
                <input className="input" type="number" placeholder="e.g. 5" value={targetReps} onChange={e => setTargetReps(e.target.value)} />
              </div>
            </div>

            <button className="btn btn--primary btn--full" onClick={add} style={{ marginBottom: 10 }}>Add Goal</button>
            <button className="btn btn--ghost btn--full" onClick={onClose}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
