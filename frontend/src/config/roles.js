/**
 * Roles definition and helper metadata.
 */

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
  WORKER: 'worker',
  CLIENT: 'client',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.SUPERVISOR]: 'Site Supervisor',
  [ROLES.WORKER]: 'Site Worker',
  [ROLES.CLIENT]: 'Client',
};

export const ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: 'Complete system access, user management, and company-wide configurations',
  [ROLES.MANAGER]: 'Project lifecycle, client relationships, task assignments, payments, and site oversight',
  [ROLES.SUPERVISOR]: 'Field management, site progress tracking, task monitoring, and daily site reporting',
  [ROLES.WORKER]: 'Daily site attendance, assigned trade tasks, materials checklist, and personal payslips',
  [ROLES.CLIENT]: 'Dedicated real-time portal for home/commercial project milestones and payments',
};
