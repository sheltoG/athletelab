import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, getSetting } from '../db';
import './ActiveWorkout.css';

// ─── Shared AudioContext for iOS compatibility ─────────────────────────────────
let sharedAudioCtx = null;

function ensureAudioCtx() {
  if (!sharedAudioCtx) {
    try {
      const AudioCtx = window.AudioContext || window['webkitAudioContext'];
    sharedAudioCtx = new AudioCtx();
    } catch (_) {}
  }
  return sharedAudioCtx;
}

function playBeep() {
  try {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    [0, 0.15, 0.3].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = i === 2 ? 1046 : 880;
      gain.gain.setValueAtTime(0.5, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.3);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.35);
    });
  } catch (_) {}
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
function pad(n) { return String(n).padStart(2, '0'); }

function makeSet(extra = {}) {
  return { id: crypto.randomUUID(), reps: '', weight: '', holdTime: '', completed: false, timestamp: null, ...extra };
}

function makeExerciseEntry(exercise) {
  const count = exercise.defaultSets || 1;
  const setDefaults = exercise.isIsometric && exercise.defaultSecs
    ? { holdTime: String(exercise.defaultSecs) }
    : exercise.defaultReps
    ? { reps: String(exercise.defaultReps) }
    : {};
  const sets = Array.from({ length: count }, () => makeSet(setDefaults));
  if (exercise.defaultExtraLeftSet) sets.push(makeSet({ isExtraLeft: true, ...setDefaults }));
  return {
    id: crypto.randomUUID(),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    category: exercise.category,
    isIsometric: exercise.isIsometric || false,
    isUnilateral: exercise.isUnilateral || false,
    hasSpeedStrengthMode: exercise.hasSpeedStrengthMode || false,
    speedStrengthMode: null,
    videoUrl: exercise.videoUrl || '',
    extraLeftSet: exercise.defaultExtraLeftSet || false,
    tags: exercise.tags || [],
    supersetGroup: null,
    skipped: false,
    sets,
  };
}

const WORKOUT_TYPES = [
  { value: 'workout', label: 'Workout' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'accessory', label: 'Accessory' },
];

export default function ActiveWorkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const startTime = useRef(null);
  const workoutTimerRef = useRef(null);
  const restTimerRef = useRef(null);

  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [exercises, setExercises] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [replacingEntryId, setReplacingEntryId] = useState(null);
  const [restRemaining, setRestRemaining] = useState(null);
  const [restActive, setRestActive] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [defaultRest, setDefaultRest] = useState(30);
  const [workoutType, setWorkoutType] = useState('workout');
  const [workoutFormat, setWorkoutFormat] = useState('standard');
  const [templateName, setTemplateName] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');

  // Unlock AudioContext on first user touch (iOS requirement)
  useEffect(() => {
    const unlock = () => {
      const ctx = ensureAudioCtx();
      if (ctx?.state === 'suspended') ctx.resume();
    };
    document.addEventListener('touchstart', unlock, { once: true });
    return () => document.removeEventListener('touchstart', unlock);
  }, []);

  // Load default rest timer and optional template
  useEffect(() => {
    getSetting('defaultRestTimerSeconds').then(v => {
      if (v) { setDefaultRest(v); }
    });

    const templateId = location.state?.templateId;
    if (templateId) {
      db.workoutTemplates.get(templateId).then(async template => {
        if (!template) return;
        if (template.name) setTemplateName(template.name);
        if (template.notes) setTemplateNotes(template.notes);
        if (template.workoutType) setWorkoutType(template.workoutType);
        if (template.format) setWorkoutFormat(template.format);
        if (!template.exercises?.length) return;

        // Look up full exercise data for tags and other properties
        const exerciseIds = template.exercises.map(ex => ex.exerciseId);
        const exercisesData = await db.exercises.bulkGet(exerciseIds);
        const exerciseMap = {};
        exercisesData.forEach(e => { if (e) exerciseMap[e.id] = e; });

        const entries = template.exercises.map(ex => {
          const fullEx = exerciseMap[ex.exerciseId] || {};
          const baseSets = Array.from({ length: ex.defaultSets || 1 }, () => {
            const s = makeSet();
            if (ex.isIsometric) {
              s.holdTime = ex.defaultReps ? String(ex.defaultReps) : '';
            } else {
              s.reps = ex.defaultReps ? String(ex.defaultReps) : '';
            }
            return s;
          });
          if (ex.defaultExtraLeftSet) {
            baseSets.push(makeSet({ isExtraLeft: true }));
          }
          return {
            id: crypto.randomUUID(),
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            category: ex.category || '',
            isIsometric: ex.isIsometric || false,
            isUnilateral: ex.isUnilateral || false,
            hasSpeedStrengthMode: ex.hasSpeedStrengthMode || false,
            speedStrengthMode: null,
            videoUrl: ex.videoUrl || '',
            extraLeftSet: ex.defaultExtraLeftSet || false,
            tags: fullEx.tags || ex.tags || [],
            supersetGroup: ex.supersetGroup || null,
            skipped: false,
            sets: baseSets,
          };
        });
        setExercises(entries);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Workout elapsed timer
  useEffect(() => {
    if (!timerStarted) return;
    workoutTimerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 1000);
    return () => clearInterval(workoutTimerRef.current);
  }, [timerStarted]);

  const startTimer = () => {
    if (timerStarted) return;
    startTime.current = Date.now();
    setTimerStarted(true);
  };

  // Rest timer
  useEffect(() => {
    if (!restActive) return;
    if (restRemaining <= 0) {
      setRestActive(false);
      setRestRemaining(null);
      playBeep();
      return;
    }
    restTimerRef.current = setTimeout(() => {
      setRestRemaining(r => r - 1);
    }, 1000);
    return () => clearTimeout(restTimerRef.current);
  }, [restActive, restRemaining]);

  const startRest = useCallback((duration) => {
    setRestRemaining(duration ?? defaultRest);
    setRestActive(true);
  }, [defaultRest]);

  const stopRest = () => { setRestActive(false); setRestRemaining(null); };

  // ─── Exercise / set mutations ───────────────────────────────────────────────
  const addExercise = (exercise) => {
    if (replacingEntryId) {
      replaceExercise(replacingEntryId, exercise);
      setReplacingEntryId(null);
    } else {
      setExercises(prev => [...prev, makeExerciseEntry(exercise)]);
    }
    setShowExercisePicker(false);
  };

  const replaceExercise = (entryId, exercise) => {
    setExercises(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      // Reset sets when switching between iso and non-iso to avoid input mismatch
      const typeChanged = e.isIsometric !== (exercise.isIsometric || false);
      return {
        ...e,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        category: exercise.category,
        isIsometric: exercise.isIsometric || false,
        isUnilateral: exercise.isUnilateral || false,
        hasSpeedStrengthMode: exercise.hasSpeedStrengthMode || false,
        videoUrl: exercise.videoUrl || '',
        tags: exercise.tags || [],
        speedStrengthMode: null,
        sets: typeChanged ? [makeSet()] : e.sets,
      };
    }));
  };

  const removeExercise = (entryId) => {
    setExercises(prev => prev.filter(e => e.id !== entryId));
  };

  const toggleSkip = (entryId) => {
    setExercises(prev => prev.map(e =>
      e.id === entryId ? { ...e, skipped: !e.skipped } : e
    ));
  };

  const updateExerciseField = (entryId, field, value) => {
    setExercises(prev => prev.map(e =>
      e.id === entryId ? { ...e, [field]: value } : e
    ));
  };

  const toggleExtraLeftSet = (entryId) => {
    setExercises(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const hasExtra = e.sets.some(s => s.isExtraLeft);
      if (hasExtra) {
        return { ...e, extraLeftSet: false, sets: e.sets.filter(s => !s.isExtraLeft) };
      }
      return { ...e, extraLeftSet: true, sets: [...e.sets, makeSet({ isExtraLeft: true })] };
    }));
  };

  const addSet = (entryId) => {
    setExercises(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const newSet = makeSet();
      const extraIdx = e.sets.findIndex(s => s.isExtraLeft);
      if (extraIdx >= 0) {
        const sets = [...e.sets];
        sets.splice(extraIdx, 0, newSet);
        return { ...e, sets };
      }
      return { ...e, sets: [...e.sets, newSet] };
    }));
  };

  const removeSet = (entryId, setId) => {
    setExercises(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const removed = e.sets.find(s => s.id === setId);
      return {
        ...e,
        extraLeftSet: removed?.isExtraLeft ? false : e.extraLeftSet,
        sets: e.sets.filter(s => s.id !== setId),
      };
    }));
  };

  const updateSet = (entryId, setId, field, value) => {
    setExercises(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const setIndex = e.sets.findIndex(s => s.id === setId);
      // Propagate reps or weight from first set to all subsequent incomplete non-extra sets
      if ((field === 'reps' || field === 'weight') && setIndex === 0) {
        return {
          ...e,
          sets: e.sets.map((s, i) => {
            if (s.id === setId) return { ...s, [field]: value };
            if (i > 0 && !s.completed && !s.isExtraLeft) return { ...s, [field]: value };
            return s;
          }),
        };
      }
      return { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) };
    }));
  };

  const toggleSetComplete = useCallback((entryId, setId) => {
    const currentEntry = exercises.find(e => e.id === entryId);
    const currentSet = currentEntry?.sets.find(s => s.id === setId);
    const isCompleting = currentSet && !currentSet.completed;

    setExercises(prev => {
      return prev.map(e => {
        if (e.id !== entryId) return e;
        return {
          ...e, sets: e.sets.map(s => {
            if (s.id !== setId) return s;
            const completed = !s.completed;
            if (completed) startRest(defaultRest);
            return { ...s, completed, timestamp: completed ? Date.now() : null };
          })
        };
      });
    });

    if (isCompleting && !timerStarted) startTimer();
  }, [exercises, defaultRest, timerStarted, startRest]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Finish workout ─────────────────────────────────────────────────────────
  const finishWorkout = async () => {
    const now = Date.now();
    const sessionStart = startTime.current ?? now;
    const duration = timerStarted ? now - sessionStart : 0;
    const sessionData = {
      date: sessionStart,
      duration,
      workoutType,
      workoutFormat,
      templateId: location.state?.templateId ?? null,
      exercises: exercises.map(e => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        isIsometric: e.isIsometric || false,
        isUnilateral: e.isUnilateral || false,
        speedStrengthMode: e.speedStrengthMode || null,
        supersetGroup: e.supersetGroup || null,
        skipped: e.skipped || false,
        sets: e.sets.map(s => ({
          reps: Number(s.reps) || 0,
          weight: Number(s.weight) || 0,
          holdTime: Number(s.holdTime) || 0,
          completed: s.completed,
          timestamp: s.timestamp,
          isExtraLeft: s.isExtraLeft || false,
        })),
      })),
    };

    const sessionId = await db.workoutSessions.add(sessionData);

    // PR detection — skip isometric exercises
    for (const entry of exercises) {
      if (entry.isIsometric) continue;
      const completedSets = entry.sets.filter(s => s.completed && s.reps && s.weight);
      for (const set of completedSets) {
        const reps = Number(set.reps);
        const weight = Number(set.weight);
        const allPRs = await db.personalRecords.where('exerciseId').equals(entry.exerciseId).toArray();
        const existingPR = allPRs.find(p => p.repCount === reps);

        if (!existingPR || weight > existingPR.weight) {
          if (existingPR) {
            await db.personalRecords.update(existingPR.id, { weight, date: set.timestamp || Date.now(), sessionId });
          } else {
            await db.personalRecords.add({
              exerciseId: entry.exerciseId,
              exerciseName: entry.exerciseName,
              repCount: reps,
              weight,
              date: set.timestamp || Date.now(),
              sessionId,
            });
          }
        }
      }
    }

    navigate('/');
  };

  const renderCard = (entry) => (
    <ExerciseCard
      key={entry.id}
      entry={entry}
      onAddSet={() => addSet(entry.id)}
      onRemoveSet={(setId) => removeSet(entry.id, setId)}
      onUpdateSet={(setId, field, val) => updateSet(entry.id, setId, field, val)}
      onToggleComplete={(setId) => toggleSetComplete(entry.id, setId)}
      onRemoveExercise={() => removeExercise(entry.id)}
      onUpdateExercise={(field, val) => updateExerciseField(entry.id, field, val)}
      onToggleExtraLeft={() => toggleExtraLeftSet(entry.id)}
      onToggleSkip={() => toggleSkip(entry.id)}
      onReplace={() => { setReplacingEntryId(entry.id); setShowExercisePicker(true); }}
    />
  );

  const renderExercises = (exList, fmt) => {
    if (fmt !== 'superset') return exList.map(renderCard);

    // Build groups of consecutive exercises with same pair-number prefix
    const groups = [];
    let i = 0;
    while (i < exList.length) {
      const entry = exList[i];
      const prefix = entry.supersetGroup?.[0];
      if (!prefix) {
        groups.push({ type: 'single', entries: [entry] });
        i++;
        continue;
      }
      const groupEntries = [entry];
      let j = i + 1;
      while (j < exList.length && exList[j].supersetGroup?.[0] === prefix) {
        groupEntries.push(exList[j]);
        j++;
      }
      groups.push(groupEntries.length > 1
        ? { type: 'superset', prefix, entries: groupEntries }
        : { type: 'single', entries: [entry] }
      );
      i = j;
    }

    return groups.map((g, gi) => {
      if (g.type === 'single') return renderCard(g.entries[0]);
      return (
        <div key={`superset-${gi}`} className="superset-block">
          <div className="superset-block__label">Superset {g.prefix}</div>
          {g.entries.map(renderCard)}
        </div>
      );
    });
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="workout-header">
        <button className="btn btn--ghost btn--sm" onClick={() => setShowCancel(true)}>Cancel</button>
        <div className="workout-header__timer">
          {timerStarted ? (
            <span className="workout-header__elapsed">{fmtTime(elapsed)}</span>
          ) : (
            <button className="btn btn--ghost btn--sm" onClick={startTimer}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Start Timer
            </button>
          )}
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setShowFinish(true)}>Finish</button>
      </div>

      {/* Workout type classifier */}
      <div className="workout-type-bar">
        {WORKOUT_TYPES.map(t => (
          <button
            key={t.value}
            className={`chip ${workoutType === t.value ? 'active' : ''}`}
            onClick={() => setWorkoutType(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rest timer bar */}
      {restActive && (
        <div className="rest-bar" onClick={stopRest}>
          <div className="rest-bar__inner">
            <span className="rest-bar__label">Rest</span>
            <span className="rest-bar__time">{fmtTime(restRemaining * 1000)}</span>
            <span className="rest-bar__tap">tap to dismiss</span>
          </div>
          <div className="rest-bar__track">
            <div
              className="rest-bar__fill"
              style={{ width: `${((defaultRest - restRemaining) / defaultRest) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="page-content--no-nav workout-content">
        {(templateName || templateNotes) && (
          <div className="template-banner">
            {templateName && <div className="template-banner__name">{templateName}</div>}
            {templateNotes && <div className="template-banner__notes">{templateNotes}</div>}
          </div>
        )}

        {exercises.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">🏋️</div>
            <div className="empty-state__title">No exercises yet</div>
            <div className="empty-state__subtitle">Add an exercise to start logging</div>
          </div>
        )}

        {renderExercises(exercises, workoutFormat)}

        <button
          className="btn btn--secondary btn--full add-exercise-btn"
          onClick={() => setShowExercisePicker(true)}
        >
          + Add Exercise
        </button>
      </div>

      {showExercisePicker && (
        <ExercisePicker
          onSelect={addExercise}
          replaceMode={!!replacingEntryId}
          onClose={() => { setShowExercisePicker(false); setReplacingEntryId(null); }}
        />
      )}

      {showCancel && (
        <div className="overlay" onClick={() => setShowCancel(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet__handle" />
            <div className="sheet__title">Cancel Workout?</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, textAlign: 'center', fontSize: 14 }}>
              Your progress will not be saved.
            </p>
            <button className="btn btn--danger btn--full" style={{ marginBottom: 10 }} onClick={() => navigate('/')}>
              Discard Workout
            </button>
            <button className="btn btn--ghost btn--full" onClick={() => setShowCancel(false)}>
              Keep Going
            </button>
          </div>
        </div>
      )}

      {showFinish && (
        <div className="overlay" onClick={() => setShowFinish(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet__handle" />
            <div className="sheet__title">Finish Workout?</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, textAlign: 'center', fontSize: 14 }}>
              {exercises.length} exercises · {fmtTime(elapsed)} elapsed
            </p>
            <button className="btn btn--primary btn--full" style={{ marginBottom: 10 }} onClick={finishWorkout}>
              Save &amp; Finish
            </button>
            <button className="btn btn--ghost btn--full" onClick={() => setShowFinish(false)}>
              Keep Going
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exercise card ──────────────────────────────────────────────────────────────
function ExerciseCard({ entry, onAddSet, onRemoveSet, onUpdateSet, onToggleComplete, onRemoveExercise, onUpdateExercise, onToggleExtraLeft, onToggleSkip, onReplace }) {
  const [prevSets, setPrevSets] = useState([]);
  const [isoCountdowns, setIsoCountdowns] = useState({});
  const isoTimerRefs = useRef({});

  useEffect(() => {
    db.workoutSessions
      .orderBy('date')
      .reverse()
      .filter(s => s.exercises?.some(e => e.exerciseId === entry.exerciseId))
      .first()
      .then(session => {
        if (!session) return;
        const ex = session.exercises.find(e => e.exerciseId === entry.exerciseId);
        if (ex?.sets) setPrevSets(ex.sets);
      })
      .catch(() => {});
  }, [entry.exerciseId]);

  // ISO countdown ticks
  useEffect(() => {
    const active = Object.entries(isoCountdowns);
    if (active.length === 0) return;
    active.forEach(([setId, remaining]) => {
      if (remaining <= 0) {
        onToggleComplete(setId);
        playBeep();
        setIsoCountdowns(prev => { const n = { ...prev }; delete n[setId]; return n; });
      } else {
        isoTimerRefs.current[setId] = setTimeout(() => {
          setIsoCountdowns(prev => {
            if (prev[setId] === undefined) return prev;
            return { ...prev, [setId]: prev[setId] - 1 };
          });
        }, 1000);
      }
    });
    return () => {
      active.forEach(([setId]) => clearTimeout(isoTimerRefs.current[setId]));
    };
  }, [isoCountdowns]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIsoToggle = (set) => {
    if (set.completed) {
      onToggleComplete(set.id);
      return;
    }
    const holdSecs = Number(set.holdTime);
    if (!holdSecs || holdSecs <= 0) {
      onToggleComplete(set.id);
      return;
    }
    if (isoCountdowns[set.id] !== undefined) {
      // Cancel the countdown
      clearTimeout(isoTimerRefs.current[set.id]);
      setIsoCountdowns(prev => { const n = { ...prev }; delete n[set.id]; return n; });
      return;
    }
    setIsoCountdowns(prev => ({ ...prev, [set.id]: holdSecs }));
  };

  const isIso = entry.isIsometric;
  const isMobility = entry.tags?.includes('Mobility') || entry.tags?.includes('BodyWeight');
  const isDumbbell = entry.tags?.includes('Dumbbell');
  const hasExtra = entry.sets.some(s => s.isExtraLeft);

  // Skipped state — collapsed view
  if (entry.skipped) {
    return (
      <div className="card exercise-card exercise-card--skipped">
        <div className="exercise-card__skip-row">
          <div>
            <div className="exercise-card__name">{entry.exerciseName}</div>
            <div className="exercise-card__category">{entry.category}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="exercise-card__skip-badge">Skipped</span>
            <button className="btn btn--ghost btn--sm" onClick={onToggleSkip}>Resume</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card exercise-card slide-in">
      <div className="exercise-card__header">
        <div>
          <div className="exercise-card__name">{entry.exerciseName}</div>
          <div className="exercise-card__category">
            {entry.category}{isIso ? ' · Isometric' : ''}
            {entry.isUnilateral ? ' · Unilateral' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {entry.videoUrl && (
            <a
              href={entry.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--ghost btn--icon exercise-card__video-btn"
              title="Watch tutorial video"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--danger)">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
              </svg>
            </a>
          )}
          <button className="btn btn--ghost btn--sm exercise-card__skip-btn" onClick={onReplace} title="Replace exercise">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </button>
          <button className="btn btn--ghost btn--sm exercise-card__skip-btn" onClick={onToggleSkip} title="Skip exercise">
            Skip
          </button>
          <button className="btn btn--ghost btn--icon" onClick={onRemoveExercise}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Speed / Strength mode toggle */}
      {entry.hasSpeedStrengthMode && (
        <div className="exercise-card__mode-bar">
          <button
            className={`chip ${entry.speedStrengthMode === 'strength' ? 'active' : ''}`}
            onClick={() => onUpdateExercise('speedStrengthMode', entry.speedStrengthMode === 'strength' ? null : 'strength')}
            style={{ flex: 1, justifyContent: 'center', padding: '7px 0', fontSize: 12 }}
          >
            Strength
          </button>
          <button
            className={`chip ${entry.speedStrengthMode === 'speed' ? 'active' : ''}`}
            onClick={() => onUpdateExercise('speedStrengthMode', entry.speedStrengthMode === 'speed' ? null : 'speed')}
            style={{ flex: 1, justifyContent: 'center', padding: '7px 0', fontSize: 12 }}
          >
            Speed
          </button>
        </div>
      )}

      <div className={`set-header ${isMobility ? 'set-header--no-weight' : ''}`}>
        <span>Set</span>
        <span>Prev</span>
        {!isMobility && <span>{isDumbbell ? 'per DB' : 'lbs'}</span>}
        <span>{isIso ? 'Secs' : 'Reps'}</span>
        <span></span>
        <span></span>
      </div>

      {entry.sets.map((set, idx) => {
        const regularIdx = entry.sets.slice(0, idx).filter(s => !s.isExtraLeft).length + 1;
        const displayIndex = set.isExtraLeft ? 'L' : regularIdx;
        return isIso ? (
          <IsometricSetRow
            key={set.id}
            set={set}
            index={displayIndex}
            prev={prevSets[idx]}
            onUpdate={(field, val) => onUpdateSet(set.id, field, val)}
            onToggle={() => handleIsoToggle(set)}
            onRemove={() => onRemoveSet(set.id)}
            countdown={isoCountdowns[set.id]}
            totalHold={Number(set.holdTime)}
            isMobility={isMobility}
          />
        ) : (
          <SetRow
            key={set.id}
            set={set}
            index={displayIndex}
            prev={prevSets[idx]}
            onUpdate={(field, val) => onUpdateSet(set.id, field, val)}
            onToggle={() => onToggleComplete(set.id)}
            onRemove={() => onRemoveSet(set.id)}
            isMobility={isMobility}
          />
        );
      })}

      <div className="exercise-card__footer">
        <button className="btn btn--ghost btn--sm add-set-btn" onClick={onAddSet}>
          + Add Set
        </button>
        {entry.isUnilateral && (
          <button
            className={`btn btn--ghost btn--sm exercise-card__extra-left ${hasExtra ? 'exercise-card__extra-left--active' : ''}`}
            onClick={onToggleExtraLeft}
          >
            {hasExtra ? '✕ Left Set' : '＋ Left Set'}
          </button>
        )}
      </div>
    </div>
  );
}

function SetRow({ set, index, prev, onUpdate, onToggle, onRemove, isMobility }) {
  const prevLabel = prev
    ? isMobility
      ? `${prev.reps || '–'} reps`
      : `${prev.weight || '–'} × ${prev.reps || '–'}`
    : '–';
  return (
    <div className={`set-row ${set.completed ? 'set-row--done' : ''} ${set.isExtraLeft ? 'set-row--extra-left' : ''} ${isMobility ? 'set-row--no-weight' : ''}`}>
      <span className={`set-row__num ${set.isExtraLeft ? 'set-row__num--left' : ''}`}>{index}</span>
      <span className="set-row__prev">{prevLabel}</span>
      {!isMobility && (
        <input
          className={`set-row__input ${set.completed ? 'set-row__input--done' : ''}`}
          type="number"
          inputMode="decimal"
          placeholder="lbs"
          value={set.weight}
          onChange={e => onUpdate('weight', e.target.value)}
          disabled={set.completed}
        />
      )}
      <input
        className={`set-row__input ${set.completed ? 'set-row__input--done' : ''}`}
        type="number"
        inputMode="numeric"
        placeholder="Reps"
        value={set.reps}
        onChange={e => onUpdate('reps', e.target.value)}
      />
      <button
        className={`set-row__check ${set.completed ? 'set-row__check--done' : ''}`}
        onClick={onToggle}
      >
        {set.completed && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </button>
      <button className="set-row__delete" onClick={onRemove}>×</button>
    </div>
  );
}

function IsometricSetRow({ set, index, prev, onUpdate, onToggle, onRemove, countdown, totalHold, isMobility }) {
  const prevLabel = prev
    ? `${isMobility ? '' : (prev.weight ? prev.weight + ' × ' : '')}${prev.holdTime ? `${prev.holdTime}s` : '–'}`
    : '–';
  const showCountdown = countdown !== undefined;
  const countdownPct = showCountdown && totalHold > 0
    ? ((totalHold - countdown) / totalHold) * 100
    : 0;

  return (
    <>
      <div className={`set-row ${set.completed ? 'set-row--done' : ''} ${set.isExtraLeft ? 'set-row--extra-left' : ''} ${isMobility ? 'set-row--no-weight' : ''}`}>
        <span className={`set-row__num ${set.isExtraLeft ? 'set-row__num--left' : ''}`}>{index}</span>
        <span className="set-row__prev">{prevLabel}</span>
        {!isMobility && (
          <input
            className={`set-row__input ${set.completed ? 'set-row__input--done' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="lbs"
            value={set.weight}
            onChange={e => onUpdate('weight', e.target.value)}
            disabled={set.completed}
          />
        )}
        <input
          className={`set-row__input ${set.completed ? 'set-row__input--done' : ''}`}
          type="number"
          inputMode="numeric"
          placeholder="secs"
          value={set.holdTime}
          onChange={e => onUpdate('holdTime', e.target.value)}
        />
        <button
          className={`set-row__check ${set.completed ? 'set-row__check--done' : ''} ${showCountdown ? 'set-row__check--counting' : ''}`}
          onClick={onToggle}
        >
          {showCountdown ? (
            <span style={{ fontSize: 12, fontWeight: 800, color: '#000' }}>{countdown}</span>
          ) : set.completed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : null}
        </button>
        <button className="set-row__delete" onClick={onRemove}>×</button>
      </div>
      {showCountdown && (
        <div className="iso-countdown-bar">
          <div
            className="iso-countdown-bar__fill"
            style={{ width: `${countdownPct}%`, transition: 'width 1s linear' }}
          />
        </div>
      )}
    </>
  );
}

// ─── Exercise picker ────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Lower Body', 'Upper Body', 'Olympic / Power', 'Core', 'Plyometric', 'Cardio'];

function ExercisePicker({ onSelect, onClose, replaceMode }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [allExercises, setAllExercises] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCat, setCustomCat] = useState('Upper Body');
  const [customIsIso, setCustomIsIso] = useState(false);

  useEffect(() => {
    db.exercises.orderBy('name').toArray().then(setAllExercises);
  }, []);

  const filtered = allExercises.filter(ex => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || ex.category === category;
    return matchSearch && matchCat;
  });

  const addCustom = async () => {
    if (!customName.trim()) return;
    const exData = { name: customName.trim(), category: customCat, isCustom: true, isIsometric: customIsIso };
    const id = await db.exercises.add(exData);
    onSelect({ id, ...exData });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="picker-top">
          <div className="sheet__title" style={{ marginBottom: 0 }}>{replaceMode ? 'Replace Exercise' : 'Add Exercise'}</div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <input
          className="input"
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          style={{ marginBottom: 12 }}
        />

        <div className="category-scroll">
          {CATEGORIES.map(c => (
            <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="exercise-list">
          {filtered.map(ex => (
            <button key={ex.id} className="exercise-list__item" onClick={() => onSelect(ex)}>
              <span>{ex.name}</span>
              <span className="badge badge--category">{ex.category}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center', fontSize: 14 }}>
              No exercises found.
            </p>
          )}
        </div>

        <div className="divider" />

        {!showCustomForm ? (
          <button className="btn btn--secondary btn--full" onClick={() => setShowCustomForm(true)}>
            + Create Custom Exercise
          </button>
        ) : (
          <div className="custom-form slide-in">
            <input
              className="input"
              placeholder="Exercise name"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <select
              className="input"
              value={customCat}
              onChange={e => setCustomCat(e.target.value)}
              style={{ marginBottom: 10 }}
            >
              {CATEGORIES.filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <label className="custom-form__iso-label">
              <input
                type="checkbox"
                checked={customIsIso}
                onChange={e => setCustomIsIso(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Isometric exercise (hold time instead of weight)
            </label>
            <button className="btn btn--primary btn--full" onClick={addCustom} style={{ marginTop: 12 }}>
              Add Custom Exercise
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
