export function cycleDuration(cycle) {
  return cycle?.durationWeeks === 2 ? 2 : 4;
}

export function weeklyTargets(startWeight, targetWeight, durationWeeks) {
  const start = Number(startWeight) || 0;
  const target = Number(targetWeight) || 0;
  if (target <= 0) return null;
  return Array.from({ length: durationWeeks }, (_, week) => {
    if (start <= 0 || start >= target || week === durationWeeks - 1) return target;
    return Math.round((start + (target - start) * week / (durationWeeks - 1)) * 4) / 4;
  });
}
