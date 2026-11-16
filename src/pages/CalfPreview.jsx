import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { calfAccessory, calfAccessoryUpdate } from '../lib/calfAccessory';

// Prepare a local sample so the preview uses the actual app screens and flows.
export default function CalfPreview() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    db.transaction('rw', db.exercises, db.workoutTemplates, async () => {
      let exercise = await db.exercises.where('name').equals(calfAccessory.exerciseName).first();
      if (!exercise) {
        const data = { name: calfAccessory.exerciseName, category: 'Lower Body', isIsometric: true, isUnilateral: true, isCustom: false };
        exercise = { ...data, id: await db.exercises.add(data) };
      }
      const existing = await db.workoutTemplates.filter(t => t.name.trim().toLowerCase() === 'calf accessory').first();
      if (existing) return existing.id;
      return db.workoutTemplates.add({ name: calfAccessory.name, ...calfAccessoryUpdate(exercise.id) });
    }).then(id => {
      if (!cancelled) navigate(`/template/${id}`, { replace: true });
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [navigate]);

  return <div className="page" style={{ padding: 24 }}>{error || 'Opening app preview…'}</div>;
}
