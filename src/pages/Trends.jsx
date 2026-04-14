import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from 'recharts';
import { db, getSetting, setSetting } from '../db';
import './Trends.css';

const TIME_RANGES = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 4 Weeks', days: 28 },
  { label: 'Last 3 Months', days: 91 },
  { label: 'Last 6 Months', days: 182 },
  { label: 'Last 1 Year', days: 365 },
];

const REP_OPTIONS = ['All', 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

export default function Trends() {
  const [exercises, setExercises] = useState([]);
  const [selectedEx, setSelectedEx] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [prs, setPrs] = useState([]);
  const [timeRange, setTimeRange] = useState(TIME_RANGES[1]); // default: last 4 weeks
  const [showRangeSheet, setShowRangeSheet] = useState(false);
  const [repFilter, setRepFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState(null); // null | 'speed' | 'strength'
  const [view, setView] = useState('chart'); // 'chart' | 'prs'
  const [trackedIds, setTrackedIds] = useState([]);

  useEffect(() => {
    db.exercises.orderBy('name').toArray().then(setExercises);
    db.personalRecords.toArray().then(setPrs);
    getSetting('trackedExercises').then(v => setTrackedIds(v ?? []));
  }, []);

  useEffect(() => {
    if (!selectedEx) { setSessions([]); return; }
    const since = Date.now() - timeRange.days * 24 * 3600 * 1000;
    db.workoutSessions
      .where('date').above(since)
      .toArray()
      .then(all => {
        const relevant = all.filter(s =>
          s.exercises?.some(e => e.exerciseId === selectedEx.id)
        );
        setSessions(relevant);
      });
  }, [selectedEx, timeRange]);

  const toggleTrack = async (ex) => {
    const next = trackedIds.includes(ex.id)
      ? trackedIds.filter(id => id !== ex.id)
      : [...trackedIds, ex.id];
    setTrackedIds(next);
    await setSetting('trackedExercises', next);
  };

  const handleSelectEx = (ex) => {
    setSelectedEx(ex);
    setRepFilter('All');
    setModeFilter(null);
  };

  const isTracked = selectedEx && trackedIds.includes(selectedEx.id);

  // Build chart data
  const chartData = buildChartData(sessions, selectedEx?.id, repFilter, modeFilter);
  const prPoints = chartData.filter(d => d.isPR);

  // PR list for selected exercise
  const exercisePRs = prs.filter(p => selectedEx && p.exerciseId === selectedEx.id)
    .sort((a, b) => a.repCount - b.repCount);

  // All PRs grouped by exercise
  const allPRs = [...prs].sort((a, b) => {
    if (a.exerciseName < b.exerciseName) return -1;
    if (a.exerciseName > b.exerciseName) return 1;
    return a.repCount - b.repCount;
  });

  // Tracked exercises for quick-select chips
  const trackedExercises = trackedIds
    .map(id => exercises.find(e => e.id === id))
    .filter(Boolean);

  // Auto-list: exercises with PRs, for the no-exercise-selected state
  const prsByExercise = prs.reduce((acc, pr) => {
    if (!acc[pr.exerciseId]) {
      acc[pr.exerciseId] = { exerciseId: pr.exerciseId, exerciseName: pr.exerciseName, best: pr };
    } else {
      if (pr.weight > acc[pr.exerciseId].best.weight) acc[pr.exerciseId].best = pr;
    }
    return acc;
  }, {});
  const autoListExercises = Object.values(prsByExercise)
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));

  return (
    <div className="page">
      <div className="page-content">
        <div className="trends-header">
          <h2>Training Trends</h2>
          <button className="time-range-btn" onClick={() => setShowRangeSheet(true)}>
            {timeRange.label} <span style={{ marginLeft: 4, opacity: 0.6 }}>▼</span>
          </button>
        </div>

        {/* View toggle */}
        <div className="plan-tabs" style={{ marginBottom: 16 }}>
          <button className={`plan-tab ${view === 'chart' ? 'plan-tab--active' : ''}`} onClick={() => setView('chart')}>Lift Progress</button>
          <button className={`plan-tab ${view === 'prs' ? 'plan-tab--active' : ''}`} onClick={() => setView('prs')}>PR Records</button>
        </div>

        {view === 'chart' && (
          <>
            {/* Tracked exercise quick-select */}
            {trackedExercises.length > 0 && (
              <div className="tracked-exercises">
                <div className="tracked-exercises__label">Tracking</div>
                <div className="tracked-exercises__chips">
                  {trackedExercises.map(ex => (
                    <button
                      key={ex.id}
                      className={`chip ${selectedEx?.id === ex.id ? 'active' : ''}`}
                      onClick={() => handleSelectEx(selectedEx?.id === ex.id ? null : ex)}
                    >
                      {ex.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Exercise selector */}
            <div className="trends-selector-row">
              <ExerciseSelector
                exercises={exercises}
                selected={selectedEx}
                onSelect={handleSelectEx}
              />
              {selectedEx && (
                <button
                  className={`btn btn--ghost btn--icon trends-track-btn ${isTracked ? 'trends-track-btn--active' : ''}`}
                  onClick={() => toggleTrack(selectedEx)}
                  title={isTracked ? 'Untrack exercise' : 'Track exercise'}
                >
                  {isTracked ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* Speed / Strength mode filter */}
            {selectedEx?.hasSpeedStrengthMode && (
              <div className="rep-filter-scroll" style={{ marginBottom: 8 }}>
                <button
                  className={`chip ${modeFilter === null ? 'active' : ''}`}
                  onClick={() => setModeFilter(null)}
                >
                  All
                </button>
                <button
                  className={`chip ${modeFilter === 'strength' ? 'active' : ''}`}
                  onClick={() => setModeFilter(modeFilter === 'strength' ? null : 'strength')}
                >
                  Strength
                </button>
                <button
                  className={`chip ${modeFilter === 'speed' ? 'active' : ''}`}
                  onClick={() => setModeFilter(modeFilter === 'speed' ? null : 'speed')}
                >
                  Speed
                </button>
              </div>
            )}

            {/* Rep filter */}
            {selectedEx && (
              <div className="rep-filter-scroll">
                {REP_OPTIONS.map(r => (
                  <button
                    key={r}
                    className={`chip ${repFilter === r ? 'active' : ''}`}
                    onClick={() => setRepFilter(r)}
                  >
                    {r === 'All' ? 'All Reps' : `${r} Rep${r !== 1 ? 's' : ''}`}
                  </button>
                ))}
              </div>
            )}

            {/* Chart */}
            {selectedEx && chartData.length > 0 ? (
              <div className="chart-card card">
                <div className="chart-card__title">{selectedEx.name}</div>
                <div className="chart-card__subtitle">
                  {modeFilter ? `${modeFilter.charAt(0).toUpperCase() + modeFilter.slice(1)} · ` : ''}
                  {repFilter === 'All' ? 'Best weight per session' : `${repFilter}-rep max`}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="dateLabel" tick={{ fill: '#555', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#555', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#d4ff00"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: '#d4ff00' }}
                    />
                    {prPoints.map((p, i) => (
                      <ReferenceDot
                        key={i}
                        x={p.dateLabel}
                        y={p.weight}
                        r={6}
                        fill="#d4ff00"
                        stroke="#000"
                        strokeWidth={2}
                        label={{ value: 'PR', position: 'top', fill: '#d4ff00', fontSize: 10, fontWeight: 700 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>

                {exercisePRs.length > 0 && (
                  <div className="chart-prs">
                    {exercisePRs.map(pr => (
                      <div key={pr.id} className="chart-pr-badge">
                        <span className="badge badge--pr">{pr.repCount}RM</span>
                        <span className="chart-pr-weight">{pr.weight} lbs</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : selectedEx ? (
              <div className="empty-state">
                <div className="empty-state__icon">📈</div>
                <div className="empty-state__title">No data yet</div>
                <div className="empty-state__subtitle">Log workouts with {selectedEx.name} to see progress here.</div>
              </div>
            ) : autoListExercises.length > 0 ? (
              /* Auto-list all tracked lifts */
              <div className="auto-lift-list">
                <div className="auto-lift-list__header">Your Lifts</div>
                {autoListExercises.map(item => (
                  <button
                    key={item.exerciseId}
                    className="auto-lift-item"
                    onClick={() => {
                      const ex = exercises.find(e => e.id === item.exerciseId);
                      if (ex) handleSelectEx(ex);
                    }}
                  >
                    <span className="auto-lift-item__name">{item.exerciseName}</span>
                    <span className="auto-lift-item__pr">
                      <span className="badge badge--pr">{item.best.repCount}RM</span>
                      <span className="auto-lift-item__weight">{item.best.weight} lbs</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon">🔍</div>
                <div className="empty-state__title">Select an exercise</div>
                <div className="empty-state__subtitle">
                  Choose an exercise and tap ☆ to pin it here for quick access.
                </div>
              </div>
            )}
          </>
        )}

        {view === 'prs' && (
          <div className="pr-list">
            {allPRs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🏆</div>
                <div className="empty-state__title">No PRs yet</div>
                <div className="empty-state__subtitle">Complete sets during workouts to auto-track your personal records.</div>
              </div>
            ) : allPRs.map(pr => (
              <div key={pr.id} className="card--flat pr-row">
                <div className="pr-row__info">
                  <div className="pr-row__name">{pr.exerciseName}</div>
                  <div className="pr-row__date">{new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div className="pr-row__right">
                  <span className="badge badge--pr">{pr.repCount} rep{pr.repCount !== 1 ? 's' : ''}</span>
                  <span className="pr-row__weight">{pr.weight} lbs</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRangeSheet && (
        <div className="overlay" onClick={() => setShowRangeSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet__handle" />
            <div className="sheet__title">Select Time Range</div>
            {TIME_RANGES.map(r => (
              <button
                key={r.days}
                className={`range-option ${timeRange.days === r.days ? 'range-option--active' : ''}`}
                onClick={() => { setTimeRange(r); setShowRangeSheet(false); }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exercise selector ─────────────────────────────────────────────────────────
function ExerciseSelector({ exercises, selected, onSelect }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="ex-selector">
      <button className="ex-selector__btn" onClick={() => setOpen(true)}>
        <span>{selected ? selected.name : 'Select exercise...'}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet__handle" />
            <div className="sheet__title">Select Exercise</div>
            <input
              className="input"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{ marginBottom: 8 }}
            />
            <div className="exercise-list">
              {filtered.map(ex => (
                <button key={ex.id} className="exercise-list__item" onClick={() => { onSelect(ex); setOpen(false); }}>
                  <span>{ex.name}</span>
                  <span className="badge badge--category">{ex.category}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: '#8a8a8a', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#d4ff00' }}>{payload[0].value} lbs</div>
      {payload[0].payload.isPR && <div style={{ fontSize: 10, color: '#d4ff00', fontWeight: 700, marginTop: 2 }}>🏆 PR</div>}
    </div>
  );
}

// ─── Chart data builder ─────────────────────────────────────────────────────────
function buildChartData(sessions, exerciseId, repFilter, modeFilter) {
  if (!exerciseId || sessions.length === 0) return [];

  let runningMax = 0;
  const points = sessions
    .sort((a, b) => a.date - b.date)
    .map(session => {
      const entry = session.exercises?.find(e => e.exerciseId === exerciseId);
      if (!entry) return null;

      // Filter by speed/strength mode when set
      if (modeFilter && entry.speedStrengthMode !== modeFilter) return null;

      const completedSets = entry.sets?.filter(s => s.completed && s.reps && s.weight) ?? [];
      const filteredSets = repFilter === 'All'
        ? completedSets
        : completedSets.filter(s => Number(s.reps) === Number(repFilter));

      if (filteredSets.length === 0) return null;

      const maxWeight = Math.max(...filteredSets.map(s => Number(s.weight)));
      const isPR = maxWeight > runningMax;
      if (isPR) runningMax = maxWeight;

      return {
        date: session.date,
        dateLabel: new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: maxWeight,
        isPR,
      };
    })
    .filter(Boolean);

  return points;
}
