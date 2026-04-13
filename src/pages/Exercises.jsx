import { useEffect, useState } from 'react';
import { db } from '../db';
import './Exercises.css';

const EXERCISE_TAGS = ['Stretch', 'Plyo', 'Power', 'Speed', 'Mobility', 'Pull', 'Push', 'Deadlift', 'Core', 'Lunge', 'Hinge'];
const CATEGORIES = ['Lower Body', 'Upper Body', 'Olympic / Power', 'Core', 'Plyometric', 'Cardio'];

export default function Exercises() {
  const [allExercises, setAllExercises] = useState([]);
  const [recentIds, setRecentIds] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    const exercises = await db.exercises.orderBy('name').toArray();
    setAllExercises(exercises);

    const sessions = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray();
    const seen = new Set();
    const ids = [];
    for (const s of sessions) {
      for (const e of s.exercises || []) {
        if (!seen.has(e.exerciseId)) {
          seen.add(e.exerciseId);
          ids.push(e.exerciseId);
        }
      }
      if (ids.length >= 5) break;
    }
    setRecentIds(ids.slice(0, 5));
  };

  useEffect(() => { load(); }, []);

  const isFiltering = search.trim() !== '' || selectedTag !== 'All';

  const filtered = allExercises.filter(ex => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchTag = selectedTag === 'All' || (ex.tags || []).includes(selectedTag);
    return matchSearch && matchTag;
  });

  const recentExercises = !isFiltering
    ? recentIds.map(id => allExercises.find(ex => ex.id === id)).filter(Boolean)
    : [];

  const recentIdSet = new Set(recentIds);
  const listExercises = isFiltering
    ? filtered
    : filtered.filter(ex => !recentIdSet.has(ex.id));

  const handleCreated = (ex) => {
    setAllExercises(prev => [...prev, ex].sort((a, b) => a.name.localeCompare(b.name)));
    setShowCreate(false);
  };

  return (
    <div className="page">
      <div className="exercises-header">
        <h1 className="exercises-header__title">Exercises</h1>
        <button className="btn btn--primary btn--sm" onClick={() => setShowCreate(true)}>+ New</button>
      </div>

      <div className="page-content exercises-content">
        <input
          className="input exercises-search"
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="tag-scroll">
          {['All', ...EXERCISE_TAGS].map(tag => (
            <button
              key={tag}
              className={`chip ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {recentExercises.length > 0 && (
          <>
            <div className="exercises-section-label">Recent</div>
            {recentExercises.map(ex => (
              <ExerciseItem key={ex.id} exercise={ex} />
            ))}
          </>
        )}

        <div className="exercises-section-label">
          {isFiltering ? 'Results' : 'All Exercises'}
          <span className="exercises-section-count">{listExercises.length}</span>
        </div>

        {listExercises.length === 0 && (
          <p className="exercises-empty">No exercises found.</p>
        )}

        {listExercises.map(ex => (
          <ExerciseItem key={ex.id} exercise={ex} />
        ))}

        <div style={{ height: 20 }} />
      </div>

      {showCreate && (
        <CreateExerciseSheet
          onSave={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function ExerciseItem({ exercise }) {
  return (
    <div className="exercise-item">
      <div className="exercise-item__left">
        <div className="exercise-item__name">{exercise.name}</div>
        <div className="exercise-item__meta">
          <span className="badge badge--category">{exercise.category}</span>
          {exercise.isIsometric && <span className="exercise-item__iso">Isometric</span>}
        </div>
        {exercise.tags?.length > 0 && (
          <div className="exercise-item__tags">
            {exercise.tags.map(tag => (
              <span key={tag} className="exercise-item__tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
      {exercise.videoUrl && (
        <a
          href={exercise.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--ghost btn--icon exercise-item__video"
          title="Watch tutorial"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--danger)">
            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
            <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
          </svg>
        </a>
      )}
    </div>
  );
}

function CreateExerciseSheet({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Upper Body');
  const [isIsometric, setIsIsometric] = useState(false);
  const [tags, setTags] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [nameMissing, setNameMissing] = useState(false);

  const toggleTag = (tag) => {
    setTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { setNameMissing(true); return; }
    const data = {
      name: name.trim(),
      category,
      isCustom: true,
      isIsometric,
      tags,
      videoUrl: videoUrl.trim(),
    };
    const id = await db.exercises.add(data);
    onSave({ id, ...data });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__title">New Exercise</div>

        <input
          className={`input ${nameMissing ? 'input--error' : ''}`}
          placeholder="Exercise name"
          value={name}
          onChange={e => { setName(e.target.value); setNameMissing(false); }}
          autoFocus
          style={{ marginBottom: 4 }}
        />
        {nameMissing && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>Please enter a name.</p>}

        <label className="create-ex__label">Category</label>
        <select
          className="input"
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label className="create-ex__label">Type</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className={`chip ${!isIsometric ? 'active' : ''}`}
            style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}
            onClick={() => setIsIsometric(false)}
          >
            Regular
          </button>
          <button
            className={`chip ${isIsometric ? 'active' : ''}`}
            style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}
            onClick={() => setIsIsometric(true)}
          >
            Isometric
          </button>
        </div>

        <label className="create-ex__label">Tags</label>
        <div className="create-ex__tags" style={{ marginBottom: 16 }}>
          {EXERCISE_TAGS.map(tag => (
            <button
              key={tag}
              className={`chip ${tags.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        <label className="create-ex__label">YouTube URL (optional)</label>
        <input
          type="url"
          className="input"
          placeholder="https://youtube.com/..."
          value={videoUrl}
          onChange={e => setVideoUrl(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        <button className="btn btn--primary btn--full" onClick={handleSave} style={{ marginBottom: 10 }}>
          Save Exercise
        </button>
        <button className="btn btn--ghost btn--full" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
