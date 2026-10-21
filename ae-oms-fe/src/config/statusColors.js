/**
 * Central mapping for status badges and indicators.
 * Maps status strings to design token color types.
 */

export const STATUS_TYPES = {
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
  INFO: 'info',
  NEUTRAL: 'neutral',
};

export const STATUS_MAP = {
  // Positive / Finished
  done: STATUS_TYPES.SUCCESS,
  completed: STATUS_TYPES.SUCCESS,
  active: STATUS_TYPES.SUCCESS,
  paid: STATUS_TYPES.SUCCESS,
  converted: STATUS_TYPES.SUCCESS,
  approved: STATUS_TYPES.SUCCESS,
  present: STATUS_TYPES.SUCCESS,
  verified: STATUS_TYPES.SUCCESS,

  // In progress / Attention
  'in progress': STATUS_TYPES.INFO,
  'in-progress': STATUS_TYPES.INFO,
  ongoing: STATUS_TYPES.INFO,
  contacted: STATUS_TYPES.INFO,
  scheduled: STATUS_TYPES.INFO,

  // Pending / Waiting
  pending: STATUS_TYPES.WARNING,
  'under review': STATUS_TYPES.WARNING,
  lead: STATUS_TYPES.WARNING,
  partial: STATUS_TYPES.WARNING,
  halfday: STATUS_TYPES.WARNING,

  // Critical / Overdue / Inactive
  late: STATUS_TYPES.DANGER,
  overdue: STATUS_TYPES.DANGER,
  inactive: STATUS_TYPES.DANGER,
  rejected: STATUS_TYPES.DANGER,
  absent: STATUS_TYPES.DANGER,
  unpaid: STATUS_TYPES.DANGER,
  blocked: STATUS_TYPES.DANGER,

  // Neutral / Not started / Draft
  'not started': STATUS_TYPES.NEUTRAL,
  'not-started': STATUS_TYPES.NEUTRAL,
  new: STATUS_TYPES.NEUTRAL,
  draft: STATUS_TYPES.NEUTRAL,
  upcoming: STATUS_TYPES.NEUTRAL,
};

export const STATUS_CLASSES = {
  [STATUS_TYPES.SUCCESS]: 'bg-success-light text-success border-success/30',
  [STATUS_TYPES.WARNING]: 'bg-warning-light text-warning border-warning/30',
  [STATUS_TYPES.DANGER]: 'bg-danger-light text-danger border-danger/30',
  [STATUS_TYPES.INFO]: 'bg-info-light text-info border-info/30',
  [STATUS_TYPES.NEUTRAL]: 'bg-brand-50 text-brand-600 border-border',
};

/**
 * Resolves any status key into standard badge classes.
 * @param {string} status
 * @returns {{ type: string, classes: string, label: string }}
 */
export function getStatusStyle(status = '') {
  const normalized = String(status).toLowerCase().trim();
  const type = STATUS_MAP[normalized] || STATUS_TYPES.NEUTRAL;
  const classes = STATUS_CLASSES[type];
  return {
    type,
    classes,
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : '-',
  };
}
