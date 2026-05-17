import Dexie from 'dexie';

export const db = new Dexie('AthleteLab');

db.version(1).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
});

db.version(2).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
}).upgrade(async tx => {
  // Remove duplicate exercises — keep the lowest id per name
  const exercises = await tx.table('exercises').toArray();
  const seen = new Map();
  const toDelete = [];
  for (const ex of exercises) {
    if (seen.has(ex.name)) {
      toDelete.push(ex.id);
    } else {
      seen.set(ex.name, ex.id);
    }
  }
  if (toDelete.length > 0) {
    await tx.table('exercises').bulkDelete(toDelete);
  }
});

db.version(3).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
}).upgrade(async tx => {
  // Add Isometric Calf Hold if not already present
  const existing = await tx.table('exercises').where('name').equals('Isometric Calf Hold').first();
  if (!existing) {
    await tx.table('exercises').add({
      name: 'Isometric Calf Hold',
      category: 'Lower Body',
      isCustom: false,
      isIsometric: true,
    });
  }
  // Add per-category weekly targets
  for (const s of [
    { key: 'weeklyMobilityTarget', value: 6 },
    { key: 'weeklyAccessoryTarget', value: 0 },
  ]) {
    const row = await tx.table('settings').get(s.key);
    if (!row) await tx.table('settings').put(s);
  }
});

db.version(4).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
}).upgrade(async tx => {
  const newExercises = [
    { name: 'Chin-ups (underhand grip)', category: 'Upper Body', isCustom: false, tags: ['Pull'] },
    { name: 'Pull-ups (overhand grip)', category: 'Upper Body', isCustom: false, tags: ['Pull'] },
    {
      name: 'Doorframe Lat Stretch',
      category: 'Upper Body',
      isCustom: false,
      isIsometric: true,
      tags: ['Stretch', 'Mobility'],
      videoUrl: 'https://youtube.com/shorts/tGytc-KB8y4?si=vYlyD03c8URa9-OJ',
      defaultSecs: 30,
    },
    {
      name: 'Single Arm Supported Dumbbell Row',
      category: 'Upper Body',
      isCustom: false,
      tags: ['Pull'],
      videoUrl: 'https://youtu.be/DMo3HJoawrU?si=iUrI8CQ5Yt-w8Kse',
    },
  ];
  for (const ex of newExercises) {
    const existing = await tx.table('exercises').where('name').equals(ex.name).first();
    if (!existing) await tx.table('exercises').add(ex);
  }
  const trackedRow = await tx.table('settings').get('trackedTemplates');
  if (!trackedRow) await tx.table('settings').put({ key: 'trackedTemplates', value: {} });
});

db.version(5).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
}).upgrade(async tx => {
  const newExercises = [
    { name: 'Trap Bar Deadlift', category: 'Lower Body', isCustom: false, hasSpeedStrengthMode: true, tags: ['Deadlift', 'Power'] },
    { name: 'Dumbbell Reverse Lunge', category: 'Lower Body', isCustom: false },
    { name: 'Single Leg RDL', category: 'Lower Body', isCustom: false, isUnilateral: true },
    { name: 'Ab Mat Situps', category: 'Core', isCustom: false },
    { name: 'Single Leg Slider Hamstring Curl', category: 'Lower Body', isCustom: false, isUnilateral: true, videoUrl: 'https://youtube.com/shorts/4gyBsdNG5Pk?si=lyrroOOzVxnwH7KS' },
    { name: 'Half Kneeling Thoracic Rotation With Side Bend', category: 'Upper Body', isCustom: false, tags: ['Mobility'], videoUrl: 'https://youtu.be/N9HXsefD_34?si=FMuqYtq5-C3ybR5l', defaultSets: 3 },
    { name: 'T-Spine Open Books', category: 'Upper Body', isCustom: false, tags: ['Mobility'], videoUrl: 'https://youtube.com/shorts/cncdlzYmbxg?si=WBMLcXN4c-ma-kUa' },
    { name: 'Quadruped Reach Through', category: 'Core', isCustom: false, tags: ['Mobility'], videoUrl: 'https://youtube.com/shorts/U9zDpY0HpbI?si=w9vEX7Pkemgxbq46' },
    { name: 'Banded Backswing Lead Arm Press', category: 'Upper Body', isCustom: false, videoUrl: 'https://youtu.be/hB81JdIddRs?si=kg4y58GsljLK9Dje' },
    { name: 'Supine Hip-Torso Separation', category: 'Core', isCustom: false, tags: ['Core'], videoUrl: 'https://youtu.be/CVtW4oZI9rE?si=A6K0bfdO1lqbvuQ_' },
  ];
  for (const ex of newExercises) {
    const existing = await tx.table('exercises').where('name').equals(ex.name).first();
    if (!existing) await tx.table('exercises').add(ex);
  }
  // Mark Calf Raise as unilateral
  const calfRaise = await tx.table('exercises').where('name').equals('Calf Raise').first();
  if (calfRaise && !calfRaise.isUnilateral) {
    await tx.table('exercises').update(calfRaise.id, { isUnilateral: true });
  }
  // Add trackedExercises setting
  const exRow = await tx.table('settings').get('trackedExercises');
  if (!exRow) await tx.table('settings').put({ key: 'trackedExercises', value: [] });
});

db.version(6).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
}).upgrade(async tx => {
  // Banded Backswing Lead Arm Press → isometric
  const banded = await tx.table('exercises').where('name').equals('Banded Backswing Lead Arm Press').first();
  if (banded) await tx.table('exercises').update(banded.id, { isIsometric: true });

  // Add Lunge tag
  for (const name of ['Lunges', 'Dumbbell Reverse Lunge', 'Bulgarian Split Squat']) {
    const ex = await tx.table('exercises').where('name').equals(name).first();
    if (ex) await tx.table('exercises').update(ex.id, { tags: [...new Set([...(ex.tags || []), 'Lunge'])] });
  }
  // Add Hinge tag
  for (const name of ['Romanian Deadlift', 'Single Leg RDL']) {
    const ex = await tx.table('exercises').where('name').equals(name).first();
    if (ex) await tx.table('exercises').update(ex.id, { tags: [...new Set([...(ex.tags || []), 'Hinge'])] });
  }
  // Add Plyo tag
  for (const name of ['Box Jump', 'Broad Jump', 'Depth Jump', 'Hurdle Hop']) {
    const ex = await tx.table('exercises').where('name').equals(name).first();
    if (ex) await tx.table('exercises').update(ex.id, { tags: [...new Set([...(ex.tags || []), 'Plyo'])] });
  }
  // Add Power tag to Olympic lifts
  for (const name of ['Deadlift', 'Power Clean', 'Hang Clean', 'Clean & Jerk', 'Snatch']) {
    const ex = await tx.table('exercises').where('name').equals(name).first();
    if (ex) await tx.table('exercises').update(ex.id, { tags: [...new Set([...(ex.tags || []), 'Power'])] });
  }
});

db.version(7).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
}).upgrade(async tx => {
  const newExercises = [
    { name: 'Single Leg Box Jump', category: 'Plyometric', isCustom: false, tags: ['Plyo'] },
    { name: 'Med Ball Golf Swing Slam', category: 'Plyometric', isCustom: false, tags: ['Power', 'Plyo'], videoUrl: 'https://youtu.be/TYtdxT1vIx4?si=GGOzP-cG6ZdyTCyH&t=347' },
  ];
  for (const ex of newExercises) {
    const existing = await tx.table('exercises').where('name').equals(ex.name).first();
    if (!existing) await tx.table('exercises').add(ex);
  }
});

db.version(8).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
}).upgrade(async tx => {
  const calf = await tx.table('exercises').where('name').equals('Calf Raise').first();
  if (calf) await tx.table('exercises').update(calf.id, { defaultExtraLeftSet: true });
});

db.version(9).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
  diagnosticTests: '++id, date, type',
}).upgrade(async tx => {
  const newExercises = [
    { name: 'Band Walks', category: 'Lower Body', isCustom: false, tags: ['Hip'] },
    { name: 'Single Leg Glute Bridge', category: 'Lower Body', isCustom: false, isUnilateral: true },
    { name: 'High Hip Plank Circles', category: 'Core', isCustom: false, tags: ['Mobility', 'Core'] },
    { name: 'Lateral Jumps', category: 'Plyometric', isCustom: false, tags: ['Plyo'] },
    { name: 'Single Leg Medball Slams', category: 'Plyometric', isCustom: false, isUnilateral: true, tags: ['Power', 'Plyo'] },
  ];
  for (const ex of newExercises) {
    const existing = await tx.table('exercises').where('name').equals(ex.name).first();
    if (!existing) await tx.table('exercises').add(ex);
  }
});

db.version(10).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
  diagnosticTests: '++id, date, type',
}).upgrade(async tx => {
  for (const name of ['Dumbbell Row', 'Single Arm Supported Dumbbell Row', 'Dumbbell Reverse Lunge']) {
    const ex = await tx.table('exercises').where('name').equals(name).first();
    if (ex) await tx.table('exercises').update(ex.id, { tags: [...new Set([...(ex.tags || []), 'Dumbbell'])] });
  }
  const situp = await tx.table('exercises').where('name').equals('Ab Mat Situps').first();
  if (situp) await tx.table('exercises').update(situp.id, { tags: [...new Set([...(situp.tags || []), 'BodyWeight'])] });
});

db.version(11).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
  diagnosticTests: '++id, date, type',
}).upgrade(async tx => {
  const newExercises = [
    { name: 'Copenhagen Plank', category: 'Core', isCustom: false, isUnilateral: true, tags: ['Core'], videoUrl: 'https://youtube.com/shorts/IXjQrC45D7s?si=9SaDO7vA6vD3hHc0' },
    { name: 'Weighted Windmill', category: 'Lower Body', isCustom: false, isUnilateral: true, tags: ['Hip', 'Dumbbell'], videoUrl: 'https://youtube.com/shorts/BlM7-cOF9GU?si=lFRKb0uZuKMZdv5g' },
    { name: 'Med Ball Fake Toss', category: 'Plyometric', isCustom: false, tags: ['Power', 'Plyo'], videoUrl: 'https://youtube.com/shorts/3GtAip350VU?si=_k-p8auu4m-Sfphr' },
  ];
  for (const ex of newExercises) {
    const existing = await tx.table('exercises').where('name').equals(ex.name).first();
    if (!existing) await tx.table('exercises').add(ex);
  }
});

db.version(12).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
  diagnosticTests: '++id, date, type',
}).upgrade(async tx => {
  const newExercises = [
    { name: 'Single Leg Pogos', category: 'Plyometric', isCustom: false, isUnilateral: true, isIsometric: true, defaultSecs: 30, tags: ['Plyo'], videoUrl: 'https://youtube.com/shorts/1yFJH0qIoGA?si=nsR0UvHoXAyHfjzk' },
    { name: 'Explosive Band Turns', category: 'Core', isCustom: false, tags: ['Core', 'Power'] },
    { name: 'Single Hip Thrust w Dumbbell', category: 'Lower Body', isCustom: false, isUnilateral: true, tags: ['Hip', 'Dumbbell'] },
  ];
  for (const ex of newExercises) {
    const existing = await tx.table('exercises').where('name').equals(ex.name).first();
    if (!existing) await tx.table('exercises').add(ex);
  }
});

db.version(13).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
  diagnosticTests: '++id, date, type',
}).upgrade(async tx => {
  const newExercises = [
    { name: 'Kneeling Lat Stretch', category: 'Upper Body', isCustom: false, isIsometric: true, defaultSets: 10, defaultSecs: 5, tags: ['Stretch', 'Mobility'], videoUrl: 'https://youtube.com/shorts/mbSwVrZN6w8?si=RN6QDhx8SVkoWALA' },
    { name: 'Eccentric Curl Up', category: 'Core', isCustom: false, isIsometric: true, defaultSets: 5, defaultSecs: 5, tags: ['Core'], videoUrl: 'https://youtu.be/_XcDLWaF7n8?si=lX61g9pLYr_D1TMO' },
  ];
  for (const ex of newExercises) {
    const existing = await tx.table('exercises').where('name').equals(ex.name).first();
    if (!existing) await tx.table('exercises').add(ex);
  }
});

db.version(14).stores({
  exercises: '++id, name, category, isCustom',
  workoutTemplates: '++id, name',
  trainingCycles: '++id, name, startDate, isActive',
  workoutSessions: '++id, date, templateId, workoutType',
  personalRecords: '++id, exerciseId, repCount',
  settings: 'key',
  diagnosticTests: '++id, date, type',
}).upgrade(async tx => {
  const existing = await tx.table('exercises').where('name').equals('PVC Rotations').first();
  if (!existing) await tx.table('exercises').add({
    name: 'PVC Rotations', category: 'Upper Body', isCustom: false,
    defaultSets: 3, defaultReps: 20, tags: ['Mobility'],
    videoUrl: 'https://youtu.be/ZNVFeEg83uo?si=BAYzLvzUZlXoW-gR',
  });
});

const DEFAULT_EXERCISES = [
  // Lower Body
  { name: 'Squat', category: 'Lower Body', isCustom: false },
  { name: 'Front Squat', category: 'Lower Body', isCustom: false },
  { name: 'Romanian Deadlift', category: 'Lower Body', isCustom: false, tags: ['Hinge'] },
  { name: 'Leg Press', category: 'Lower Body', isCustom: false },
  { name: 'Lunges', category: 'Lower Body', isCustom: false, tags: ['Lunge'] },
  { name: 'Bulgarian Split Squat', category: 'Lower Body', isCustom: false, tags: ['Lunge'] },
  { name: 'Leg Curl', category: 'Lower Body', isCustom: false },
  { name: 'Leg Extension', category: 'Lower Body', isCustom: false },
  { name: 'Calf Raise', category: 'Lower Body', isCustom: false, isUnilateral: true, defaultExtraLeftSet: true },
  // Upper Body
  { name: 'Bench Press', category: 'Upper Body', isCustom: false },
  { name: 'Incline Bench Press', category: 'Upper Body', isCustom: false },
  { name: 'Overhead Press', category: 'Upper Body', isCustom: false },
  { name: 'Barbell Row', category: 'Upper Body', isCustom: false },
  { name: 'Pull-Up', category: 'Upper Body', isCustom: false },
  { name: 'Lat Pulldown', category: 'Upper Body', isCustom: false },
  { name: 'Dumbbell Row', category: 'Upper Body', isCustom: false, tags: ['Dumbbell'] },
  { name: 'Cable Row', category: 'Upper Body', isCustom: false },
  { name: 'Dip', category: 'Upper Body', isCustom: false },
  { name: 'Tricep Pushdown', category: 'Upper Body', isCustom: false },
  { name: 'Bicep Curl', category: 'Upper Body', isCustom: false },
  { name: 'Lateral Raise', category: 'Upper Body', isCustom: false },
  { name: 'Face Pull', category: 'Upper Body', isCustom: false },
  // Olympic / Power
  { name: 'Deadlift', category: 'Olympic / Power', isCustom: false, tags: ['Power'] },
  { name: 'Power Clean', category: 'Olympic / Power', isCustom: false, tags: ['Power'] },
  { name: 'Hang Clean', category: 'Olympic / Power', isCustom: false, tags: ['Power'] },
  { name: 'Clean & Jerk', category: 'Olympic / Power', isCustom: false, tags: ['Power'] },
  { name: 'Snatch', category: 'Olympic / Power', isCustom: false, tags: ['Power'] },
  // Core
  { name: 'Plank', category: 'Core', isCustom: false, tags: ['Core'] },
  { name: 'Ab Rollout', category: 'Core', isCustom: false, tags: ['Core'] },
  { name: 'Hanging Leg Raise', category: 'Core', isCustom: false, tags: ['Core'] },
  { name: 'Cable Crunch', category: 'Core', isCustom: false, tags: ['Core'] },
  { name: 'Russian Twist', category: 'Core', isCustom: false, tags: ['Core'] },
  // Plyometric
  { name: 'Box Jump', category: 'Plyometric', isCustom: false, tags: ['Plyo'] },
  { name: 'Broad Jump', category: 'Plyometric', isCustom: false, tags: ['Plyo'] },
  { name: 'Depth Jump', category: 'Plyometric', isCustom: false, tags: ['Plyo'] },
  { name: 'Hurdle Hop', category: 'Plyometric', isCustom: false, tags: ['Plyo'] },
  // Plyometric additions
  { name: 'Single Leg Box Jump', category: 'Plyometric', isCustom: false, tags: ['Plyo'] },
  { name: 'Med Ball Golf Swing Slam', category: 'Plyometric', isCustom: false, tags: ['Power', 'Plyo'], videoUrl: 'https://youtu.be/TYtdxT1vIx4?si=GGOzP-cG6ZdyTCyH&t=347' },
  { name: 'Lateral Jumps', category: 'Plyometric', isCustom: false, tags: ['Plyo'] },
  { name: 'Single Leg Medball Slams', category: 'Plyometric', isCustom: false, isUnilateral: true, tags: ['Power', 'Plyo'] },
  // Lower Body additions
  { name: 'Band Walks', category: 'Lower Body', isCustom: false, tags: ['Hip'] },
  { name: 'Single Leg Glute Bridge', category: 'Lower Body', isCustom: false, isUnilateral: true },
  // Core additions
  { name: 'High Hip Plank Circles', category: 'Core', isCustom: false, tags: ['Mobility', 'Core'] },
  { name: 'Copenhagen Plank', category: 'Core', isCustom: false, isUnilateral: true, tags: ['Core'], videoUrl: 'https://youtube.com/shorts/IXjQrC45D7s?si=9SaDO7vA6vD3hHc0' },
  { name: 'Weighted Windmill', category: 'Lower Body', isCustom: false, isUnilateral: true, tags: ['Hip', 'Dumbbell'], videoUrl: 'https://youtube.com/shorts/BlM7-cOF9GU?si=lFRKb0uZuKMZdv5g' },
  { name: 'Med Ball Fake Toss', category: 'Plyometric', isCustom: false, tags: ['Power', 'Plyo'], videoUrl: 'https://youtube.com/shorts/3GtAip350VU?si=_k-p8auu4m-Sfphr' },
  { name: 'Single Leg Pogos', category: 'Plyometric', isCustom: false, isUnilateral: true, isIsometric: true, defaultSecs: 30, tags: ['Plyo'], videoUrl: 'https://youtube.com/shorts/1yFJH0qIoGA?si=nsR0UvHoXAyHfjzk' },
  { name: 'Explosive Band Turns', category: 'Core', isCustom: false, tags: ['Core', 'Power'] },
  { name: 'Single Hip Thrust w Dumbbell', category: 'Lower Body', isCustom: false, isUnilateral: true, tags: ['Hip', 'Dumbbell'] },
  // Cardio / Conditioning
  { name: 'Sprint', category: 'Cardio', isCustom: false },
  { name: 'Sled Push', category: 'Cardio', isCustom: false },
  { name: 'Farmer Carry', category: 'Cardio', isCustom: false },
  { name: 'Battle Ropes', category: 'Cardio', isCustom: false },
  // Upper Body additions
  { name: 'Chin-ups (underhand grip)', category: 'Upper Body', isCustom: false, tags: ['Pull'] },
  { name: 'Pull-ups (overhand grip)', category: 'Upper Body', isCustom: false, tags: ['Pull'] },
  { name: 'Doorframe Lat Stretch', category: 'Upper Body', isCustom: false, isIsometric: true, tags: ['Stretch', 'Mobility'], videoUrl: 'https://youtube.com/shorts/tGytc-KB8y4?si=vYlyD03c8URa9-OJ', defaultSecs: 30 },
  { name: 'Single Arm Supported Dumbbell Row', category: 'Upper Body', isCustom: false, tags: ['Pull', 'Dumbbell'], videoUrl: 'https://youtu.be/DMo3HJoawrU?si=iUrI8CQ5Yt-w8Kse' },
  // v5 exercises
  { name: 'Trap Bar Deadlift', category: 'Lower Body', isCustom: false, hasSpeedStrengthMode: true, tags: ['Deadlift', 'Power'] },
  { name: 'Dumbbell Reverse Lunge', category: 'Lower Body', isCustom: false, tags: ['Lunge', 'Dumbbell'] },
  { name: 'Single Leg RDL', category: 'Lower Body', isCustom: false, isUnilateral: true, tags: ['Hinge'] },
  { name: 'Ab Mat Situps', category: 'Core', isCustom: false, tags: ['Core', 'BodyWeight'] },
  { name: 'Single Leg Slider Hamstring Curl', category: 'Lower Body', isCustom: false, isUnilateral: true, videoUrl: 'https://youtube.com/shorts/4gyBsdNG5Pk?si=lyrroOOzVxnwH7KS' },
  { name: 'Half Kneeling Thoracic Rotation With Side Bend', category: 'Upper Body', isCustom: false, tags: ['Mobility'], videoUrl: 'https://youtu.be/N9HXsefD_34?si=FMuqYtq5-C3ybR5l', defaultSets: 3 },
  { name: 'T-Spine Open Books', category: 'Upper Body', isCustom: false, tags: ['Mobility'], videoUrl: 'https://youtube.com/shorts/cncdlzYmbxg?si=WBMLcXN4c-ma-kUa' },
  { name: 'Quadruped Reach Through', category: 'Core', isCustom: false, tags: ['Mobility', 'Core'], videoUrl: 'https://youtube.com/shorts/U9zDpY0HpbI?si=w9vEX7Pkemgxbq46' },
  { name: 'Banded Backswing Lead Arm Press', category: 'Upper Body', isCustom: false, isIsometric: true, videoUrl: 'https://youtu.be/hB81JdIddRs?si=kg4y58GsljLK9Dje' },
  { name: 'Supine Hip-Torso Separation', category: 'Core', isCustom: false, tags: ['Core'], videoUrl: 'https://youtu.be/CVtW4oZI9rE?si=A6K0bfdO1lqbvuQ_' },
  { name: 'Kneeling Lat Stretch', category: 'Upper Body', isCustom: false, isIsometric: true, defaultSets: 10, defaultSecs: 5, tags: ['Stretch', 'Mobility'], videoUrl: 'https://youtube.com/shorts/mbSwVrZN6w8?si=RN6QDhx8SVkoWALA' },
  { name: 'Eccentric Curl Up', category: 'Core', isCustom: false, isIsometric: true, defaultSets: 5, defaultSecs: 5, tags: ['Core'], videoUrl: 'https://youtu.be/_XcDLWaF7n8?si=lX61g9pLYr_D1TMO' },
  { name: 'PVC Rotations', category: 'Upper Body', isCustom: false, defaultSets: 3, defaultReps: 20, tags: ['Mobility'], videoUrl: 'https://youtu.be/ZNVFeEg83uo?si=BAYzLvzUZlXoW-gR' },
];

const DEFAULT_SETTINGS = [
  { key: 'weeklyWorkoutTarget', value: 4 },
  { key: 'weeklyMobilityTarget', value: 6 },
  { key: 'weeklyAccessoryTarget', value: 0 },
  { key: 'defaultRestTimerSeconds', value: 30 },
  { key: 'weekStartDay', value: 'monday' },
  { key: 'trackedTemplates', value: {} },
  { key: 'trackedExercises', value: [] },
];

export async function seedDatabase() {
  const count = await db.exercises.count();
  if (count === 0) {
    await db.exercises.bulkAdd(DEFAULT_EXERCISES);
  }
  for (const s of DEFAULT_SETTINGS) {
    const existing = await db.settings.get(s.key);
    if (!existing) await db.settings.put(s);
  }
}

export async function getSetting(key) {
  const row = await db.settings.get(key);
  return row ? row.value : null;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

export async function exportData() {
  const payload = {
    version: 1,
    exportedAt: Date.now(),
    exercises:        await db.exercises.toArray(),
    workoutTemplates: await db.workoutTemplates.toArray(),
    trainingCycles:   await db.trainingCycles.toArray(),
    workoutSessions:  await db.workoutSessions.toArray(),
    personalRecords:  await db.personalRecords.toArray(),
    settings:         await db.settings.toArray(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `athletelab-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importData(file) {
  const text = await file.text();
  const payload = JSON.parse(text);

  await db.exercises.clear();
  await db.workoutTemplates.clear();
  await db.trainingCycles.clear();
  await db.workoutSessions.clear();
  await db.personalRecords.clear();
  await db.settings.clear();

  if (payload.exercises?.length)        await db.exercises.bulkPut(payload.exercises);
  if (payload.workoutTemplates?.length)  await db.workoutTemplates.bulkPut(payload.workoutTemplates);
  if (payload.trainingCycles?.length)    await db.trainingCycles.bulkPut(payload.trainingCycles);
  if (payload.workoutSessions?.length)   await db.workoutSessions.bulkPut(payload.workoutSessions);
  if (payload.personalRecords?.length)   await db.personalRecords.bulkPut(payload.personalRecords);
  if (payload.settings?.length)          await db.settings.bulkPut(payload.settings);
}
