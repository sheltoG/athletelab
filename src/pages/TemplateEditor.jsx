import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import './TemplateEditor.css';

const CATEGORIES = ['All', 'Lower Body', 'Upper Body', 'Olympic / Power', 'Core', 'Plyometric', 'Cardio'];

const SUPERSET_SLOTS = ['1A','1B','2A','2B','3A','3B','4A','4B','5A','5B'];

const TAG_TO_GROUP = { 'Plyo': '1A', 'Power': '1B', 'Lunge': '2A', 'Hinge': '2B', 'Core': '3A' };

function cycleGroup(current) {
  if (!current) return '1A';
  const idx = SUPERSET_SLOTS.indexOf(current);
  if (idx === -1 || idx === SUPERSET_SLOTS.length - 1) return null;
  return SUPERSET_SLOTS[idx + 1];
}

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [workoutType, setWorkoutType] = useState('workout');
  const [format, setFormat] = useState('standard');
  const [exercises, setExercises] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [nameMissing, setNameMissing] = useState(false);

  // Drag state
  const [dragSrcIdx, setDragSrcIdx] = useState(null);
  const [dragDestIdx, setDragDestIdx] = useState(null);

  useEffect(() => {
    if (!isNew) {
      db.workoutTemplates.get(Number(id)).then(t => {
        if (t) {
          setName(t.name);
          setNotes(t.notes || '');
          setWorkoutType(t.workoutType || 'workout');
          setFormat(t.format || 'standard');
          setExercises(t.exercises || []);
        }
        setLoading(false);
      });
    }
  }, [id, isNew]);

  // Window pointer-up handler for drag-to-reorder
  useEffect(() => {
    if (dragSrcIdx === null) return;
    const handleUp = () => {
      if (dragDestIdx !== null && dragDestIdx !== dragSrcIdx) {
        setExercises(prev => {
          const arr = [...prev];
          const [item] = arr.splice(dragSrcIdx, 1);
          arr.splice(dragDestIdx, 0, item);
          return arr;
        });
      }
      setDragSrcIdx(null);
      setDragDestIdx(null);
    };
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragSrcIdx, dragDestIdx]);

  const addExercise = (ex) => {
    let supersetGroup = null;
    if (format === 'superset') {
      for (const tag of (ex.tags || [])) {
        if (TAG_TO_GROUP[tag]) { supersetGroup = TAG_TO_GROUP[tag]; break; }
      }
    }
    setExercises(prev => [...prev, {
      exerciseId: ex.id,
      exerciseName: ex.name,
      category: ex.category,
      isIsometric: ex.isIsometric || false,
      isUnilateral: ex.isUnilateral || false,
      hasSpeedStrengthMode: ex.hasSpeedStrengthMode || false,
      defaultSets: ex.defaultSets || 3,
      defaultReps: ex.isIsometric ? (ex.defaultSecs || 30) : 8,
      defaultExtraLeftSet: false,
      videoUrl: ex.videoUrl || '',
      supersetGroup,
    }]);
    setShowPicker(false);
  };

  const removeExercise = (exerciseId) => {
    setExercises(prev => prev.filter(e => e.exerciseId !== exerciseId));
  };

  const updateExercise = (exerciseId, field, val) => {
    setExercises(prev => prev.map(e =>
      e.exerciseId === exerciseId ? { ...e, [field]: val } : e
    ));
  };

  const save = async () => {
    if (!name.trim()) { setNameMissing(true); return; }
    const data = { name: name.trim(), notes, workoutType, format, exercises };
    if (!isNew) {
      await db.workoutTemplates.update(Number(id), data);
    } else {
      await db.workoutTemplates.add(data);
    }
    navigate('/plan');
  };

  if (loading) return null;

  return (
    <div className="page">
      {/* Header */}
      <div className="template-editor-header">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/plan')}>← Back</button>
        <span className="template-editor-header__title">{isNew ? 'New Template' : 'Edit Template'}</span>
        <button className="btn btn--primary btn--sm" onClick={save}>Save</button>
      </div>

      <div className="page-content--no-nav template-editor-content">
        {/* Template name */}
        <input
          className={`template-editor__name-input ${nameMissing ? 'template-editor__name-input--error' : ''}`}
          placeholder="Template name (e.g. Leg Day)"
          value={name}
          onChange={e => { setName(e.target.value); setNameMissing(false); }}
          autoFocus={isNew}
        />
        {nameMissing && (
          <p className="template-editor__error">Please enter a template name.</p>
        )}

        {/* Notes */}
        <textarea
          className="template-editor__notes-input"
          placeholder="Notes (e.g. focus on tempo, warm-up cues)..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />

        {/* Workout type */}
        <div className="template-editor__section-label" style={{ marginBottom: 10 }}>Type</div>
        <div className="template-editor__type-row">
          {[
            { value: 'workout', label: 'Workout' },
            { value: 'mobility', label: 'Mobility' },
            { value: 'accessory', label: 'Accessory' },
          ].map(t => (
            <button
              key={t.value}
              className={`chip ${workoutType === t.value ? 'active' : ''}`}
              onClick={() => setWorkoutType(t.value)}
              style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Format */}
        <div className="template-editor__section-label" style={{ marginBottom: 10 }}>Format</div>
        <div className="template-editor__type-row">
          {[
            { value: 'standard', label: 'Standard' },
            { value: 'superset', label: 'Superset' },
          ].map(f => (
            <button
              key={f.value}
              className={`chip ${format === f.value ? 'active' : ''}`}
              onClick={() => setFormat(f.value)}
              style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {format === 'superset' && (
          <p className="template-editor__format-hint">
            Exercises with matching tags auto-assign to superset slots. Tap the slot badge on each exercise to cycle groups.
          </p>
        )}

        {/* Exercises */}
        <div className="template-editor__section-label">
          Exercises
          <span className="template-editor__section-count">{exercises.length}</span>
        </div>

        {exercises.length === 0 && (
          <div className="template-editor__empty">
            Add exercises to build your template.
          </div>
        )}

        {exercises.map((ex, idx) => {
          const prevEx = exercises[idx - 1];
          const isContinuingPair = format === 'superset' &&
            prevEx &&
            ex.supersetGroup && prevEx.supersetGroup &&
            ex.supersetGroup[0] === prevEx.supersetGroup[0];

          return (
            <div
              key={ex.exerciseId}
              className={`drag-wrapper${dragSrcIdx === idx ? ' drag-wrapper--dragging' : ''}${dragDestIdx === idx && dragSrcIdx !== null && dragSrcIdx !== idx ? ' drag-wrapper--over' : ''}`}
              onPointerEnter={() => { if (dragSrcIdx !== null) setDragDestIdx(idx); }}
            >
              {isContinuingPair && <div className="superset-connector" />}
              <TemplateExerciseCard
                exercise={ex}
                format={format}
                onRemove={() => removeExercise(ex.exerciseId)}
                onUpdate={(field, val) => updateExercise(ex.exerciseId, field, val)}
                onDragStart={() => { setDragSrcIdx(idx); setDragDestIdx(idx); }}
              />
            </div>
          );
        })}

        <button
          className="btn btn--secondary btn--full add-exercise-btn"
          onClick={() => setShowPicker(true)}
        >
          + Add Exercise
        </button>
      </div>

      {showPicker && (
        <ExercisePicker
          excludeIds={exercises.map(e => e.exerciseId)}
          onSelect={addExercise}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ─── Exercise card ──────────────────────────────────────────────────────────────
function TemplateExerciseCard({ exercise, format, onRemove, onUpdate, onDragStart }) {
  const [showVideo, setShowVideo] = useState(!!exercise.videoUrl);
  const isIso = exercise.isIsometric;

  return (
    <div className="card template-exercise-card slide-in">
      <div className="template-exercise-card__header">
        <div
          className="drag-handle"
          onPointerDown={e => { e.preventDefault(); onDragStart(); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.4">
            <circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/>
            <circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/>
            <circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="template-exercise-card__name">{exercise.exerciseName}</div>
          <div className="template-exercise-card__category">
            {exercise.category}{isIso ? ' · Isometric' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {format === 'superset' && (
            <button
              className={`template-group-badge ${exercise.supersetGroup ? 'template-group-badge--active' : ''}`}
              onClick={() => onUpdate('supersetGroup', cycleGroup(exercise.supersetGroup))}
              title="Tap to cycle superset group"
            >
              {exercise.supersetGroup || '–'}
            </button>
          )}
          <button className="btn btn--ghost btn--icon" onClick={onRemove}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="template-exercise-card__fields">
        <div className="template-exercise-card__field">
          <label>Sets</label>
          <input
            type="number"
            inputMode="numeric"
            className="input"
            value={exercise.defaultSets}
            onChange={e => onUpdate('defaultSets', Number(e.target.value))}
          />
        </div>
        <div className="template-exercise-card__field">
          <label>{isIso ? 'Secs' : 'Reps'}</label>
          <input
            type="number"
            inputMode="numeric"
            className="input"
            value={exercise.defaultReps}
            onChange={e => onUpdate('defaultReps', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Extra left set toggle for unilateral exercises */}
      {exercise.isUnilateral && (
        <button
          className={`btn btn--ghost btn--sm template-exercise-card__extra-left ${exercise.defaultExtraLeftSet ? 'template-exercise-card__extra-left--active' : ''}`}
          onClick={() => onUpdate('defaultExtraLeftSet', !exercise.defaultExtraLeftSet)}
        >
          {exercise.defaultExtraLeftSet ? '✕ Extra left set included' : '＋ Add extra set (left)'}
        </button>
      )}

      {showVideo ? (
        <div className="template-exercise-card__video">
          <div className="template-exercise-card__video-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--danger)">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
              <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
            </svg>
            YouTube URL
            <button
              className="btn btn--ghost btn--sm template-exercise-card__video-remove"
              onClick={() => { onUpdate('videoUrl', ''); setShowVideo(false); }}
            >
              Remove
            </button>
          </div>
          <input
            type="url"
            className="input"
            placeholder="https://youtube.com/watch?v=..."
            value={exercise.videoUrl || ''}
            onChange={e => onUpdate('videoUrl', e.target.value)}
          />
        </div>
      ) : (
        <button
          className="btn btn--ghost btn--sm template-exercise-card__add-video"
          onClick={() => setShowVideo(true)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--danger)">
            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
            <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
          </svg>
          Add YouTube video
        </button>
      )}
    </div>
  );
}

// ─── Exercise picker ────────────────────────────────────────────────────────────
function ExercisePicker({ onSelect, onClose, excludeIds }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [allExercises, setAllExercises] = useState([]);

  useEffect(() => {
    db.exercises.orderBy('name').toArray().then(setAllExercises);
  }, []);

  const filtered = allExercises.filter(ex => {
    if (excludeIds.includes(ex.id)) return false;
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || ex.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="picker-top">
          <div className="sheet__title" style={{ marginBottom: 0 }}>Add Exercise</div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
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
      </div>
    </div>
  );
}
