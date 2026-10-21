/**
 * Reference date for mock timeline logic (20 Oct 2026).
 */
export const TODAY_STR = '2026-10-20';

/**
 * Calculates project completion progress from an array of stages.
 * Rule: done = 100%, in progress = 50%, not started = 0%, averaged across all stages.
 *
 * @param {Array<Object>} stages
 * @returns {number} Integer between 0 and 100
 */
export function calculateProgress(stages = []) {
  if (!stages || stages.length === 0) return 0;

  const totalPoints = stages.reduce((sum, stage) => {
    const status = String(stage.status || '').toLowerCase().trim();
    if (status === 'done' || status === 'completed') {
      return sum + 100;
    }
    if (status === 'in progress' || status === 'in-progress') {
      return sum + 50;
    }
    return sum + 0;
  }, 0);

  return Math.round(totalPoints / stages.length);
}

/**
 * Determines whether a stage is delayed past its target completion date.
 * A stage is late if today > endDate and status is NOT done.
 *
 * @param {Object} stage
 * @param {string} [today=TODAY_STR]
 * @returns {boolean}
 */
export function isStageLate(stage, today = TODAY_STR) {
  if (!stage || !stage.endDate) return false;
  const status = String(stage.status || '').toLowerCase().trim();
  if (status === 'done' || status === 'completed') return false;

  return stage.endDate < today;
}

/**
 * Checks if a project has any late stages.
 * @param {Array<Object>} stages
 * @param {string} [today=TODAY_STR]
 * @returns {boolean}
 */
export function hasLateStages(stages = [], today = TODAY_STR) {
  return stages.some((stage) => isStageLate(stage, today));
}
