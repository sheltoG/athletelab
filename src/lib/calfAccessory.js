export const calfAccessory = {
  name: 'Calf Accessory',
  exerciseName: 'Heavy Calf Isometrics',
  sets: 5,
  repetitions: 4,
  holdSeconds: 3,
  restSeconds: 3,
  weight: 50,
  note: 'Hold the dumbbell on the same side as the leg performing the ISO.',
};

export function calfAccessoryUpdate(exerciseId) {
  const p = calfAccessory;
  return {
    workoutType: 'accessory',
    format: 'standard',
    notes: `Heavy calf isometrics: ${p.sets} sets, left side only. One set = 4 cycles: ${p.holdSeconds} seconds on, ${p.restSeconds} seconds rest, per cycle. Start with a ${p.weight} lb dumbbell. ${p.note}`,
    exercises: [{
      exerciseId, exerciseName: `${p.exerciseName} (Left Only)`, category: 'Lower Body',
      isIsometric: true, isUnilateral: true, side: 'left',
      defaultSets: p.sets, defaultReps: p.holdSeconds,
      defaultWeight: p.weight, defaultExtraLeftSet: false,
      intervalRepetitions: p.repetitions, intervalRestSeconds: p.restSeconds,
    }],
  };
}
