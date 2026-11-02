import { ROLES, getCustomRoles } from './roles';

/**
 * Single source of truth permission matrix for Aesthetic Interiors OMS.
 * Directly maps to BeForth SRS Section 2.2 (Users & Roles) and Section 3 (Functional Requirements).
 *
 * Canonical Roles:
 * A = ROLES.ADMIN ('owner')        -> Admin / Owner (head of the office)
 * M = ROLES.MANAGER ('manager')    -> Manager (office staff running projects)
 * S = ROLES.SUPERVISOR ('supervisor') -> Site Supervisor (person in charge on a site)
 * W = ROLES.WORKER ('worker')      -> Site Worker (craftsman / trade labour)
 * C = ROLES.CLIENT ('client')      -> Client (homeowner / project client)
 */
const { ADMIN: A, MANAGER: M, SUPERVISOR: S, WORKER: W, CLIENT: C } = ROLES;

/**
 * Canonical System Roles for UI & Matrix Display
 */
export const SYSTEM_ROLES = [
  { id: ROLES.ADMIN, label: 'Owner (Rohit Kumar)', hint: 'Always full access - Head of the office' },
  { id: ROLES.MANAGER, label: 'Manager (Neha Kulkarni)', hint: 'Office staff running projects & finances' },
  { id: ROLES.SUPERVISOR, label: 'Site Supervisor (Vikram Jadhav)', hint: 'Site trade oversight & daily reporting' },
  { id: ROLES.WORKER, label: 'Site Worker (Suresh Gaikwad)', hint: 'On-site trade labour, tasks & attendance' },
  { id: ROLES.CLIENT, label: 'Client (Amit Joshi)', hint: 'Homeowner - Read-only project view' },
];

/**
 * Canonical System Permissions List with Labels, Hints & Groups
 * Maps directly to SRS Modules 3.2 through 3.14
 */
export const SYSTEM_PERMISSIONS = [
  // --- MODULE 3.2: USERS, ROLES & ACCESS ---
  {
    id: 'users.manage',
    label: 'Manage Users',
    hint: 'Create, edit, and deactivate personnel/client accounts (FR-USR-01)',
    group: 'Users, Roles & Access',
  },
  {
    id: 'roles.change',
    label: 'Change Roles & Credentials',
    hint: 'Assign roles, adjust permissions & reset passwords (FR-USR-05)',
    group: 'Users, Roles & Access',
  },


  // --- MODULE 3.3: CLIENT RECORDS ---
  {
    id: 'clients.view',
    label: 'View Client Records',
    hint: 'Browse client contacts, notes & site links (FR-CLI-01)',
    group: 'Client Records & CRM',
  },
  {
    id: 'clients.manage',
    label: 'Manage Clients',
    hint: 'Create and update client address & project profiles (FR-CLI-01)',
    group: 'Client Records & CRM',
  },
  {
    id: 'clients.import',
    label: 'Import Clients from Excel',
    hint: 'Bulk import client spreadsheets into OMS (FR-CLI-02)',
    group: 'Client Records & CRM',
  },

  // --- MODULE 3.4 & 3.5: PROJECTS, ALLOCATION & STAGES ---
  {
    id: 'projects.viewAll',
    label: 'View All Projects',
    hint: 'Full oversight across all live project sites and progress (FR-PRJ-06)',
    group: 'Projects, Allocations & Stages',
  },
  {
    id: 'projects.viewAssigned',
    label: 'View Assigned Projects',
    hint: 'Site supervisor and worker access to allocated sites (FR-PRJ-02, 03)',
    group: 'Projects, Allocations & Stages',
  },
  {
    id: 'projects.viewOwn',
    label: 'View Own Project (Portal)',
    hint: 'Homeowner client view strictly limited to own residence (FR-USR-04)',
    group: 'Projects, Allocations & Stages',
  },
  {
    id: 'projects.create',
    label: 'Create Projects',
    hint: 'Initialize projects with quotation cost, floor plan and timeline (FR-PRJ-01)',
    group: 'Projects, Allocations & Stages',
  },
  {
    id: 'projects.assignPeople',
    label: 'Assign Site Personnel',
    hint: 'Allocate supervisors, trade workers and agency vendors (FR-PRJ-02, 03)',
    group: 'Projects, Allocations & Stages',
  },
  {
    id: 'agencies.manage',
    label: 'Manage Trade Agencies',
    hint: 'Maintain agency master list and trade stage mappings (FR-PRJ-04, 05)',
    group: 'Projects, Allocations & Stages',
  },
  {
    id: 'stages.editDates',
    label: 'Schedule Stage Dates',
    hint: 'Set planned start and completion milestone dates (FR-STG-04)',
    group: 'Projects, Allocations & Stages',
  },
  {
    id: 'stages.editProjectStages',
    label: 'Customize Project Stages',
    hint: 'Add, reorder, or customize stages for a project (FR-STG-03)',
    group: 'Projects, Allocations & Stages',
  },
  {
    id: 'stages.updateStatus',
    label: 'Update Stage Progress',
    hint: 'Update stage status (Not Started, In Progress, Completed) (FR-STG-07)',
    group: 'Projects, Allocations & Stages',
  },

  // --- MODULE 3.6: ATTENDANCE & GEOFENCING ---
  {
    id: 'attendance.markOwn',
    label: 'GPS Geofenced Punch',
    hint: 'Clock in/out within project perimeter from mobile PWA (FR-ATT-01, 02)',
    group: 'Attendance & Geofencing',
  },
  {
    id: 'attendance.viewBoard',
    label: 'View Daily Muster Board',
    hint: 'Daily muster roll board across all office and site staff (FR-ATT-05)',
    group: 'Attendance & Geofencing',
  },
  {
    id: 'attendance.correct',
    label: 'Attendance Corrections',
    hint: 'Manager overrides missed punches with recorded reason (FR-ATT-06)',
    group: 'Attendance & Geofencing',
  },
  {
    id: 'geofence.manage',
    label: 'Configure Geofence Coordinates',
    hint: 'Set site GPS center coordinates and radius in meters (FR-ATT-04)',
    group: 'Attendance & Geofencing',
  },

  // --- MODULE 3.7: TASK ASSIGNMENT & TRACKING ---
  {
    id: 'tasks.create',
    label: 'Create Tasks',
    hint: 'Assign site or office tasks with priorities & due dates (FR-TSK-01, 02)',
    group: 'Task Assignment & Tracking',
  },
  {
    id: 'tasks.createOwn',
    label: 'Create Own Tasks',
    hint: 'Create tasks for yourself only (a site worker)',
    group: 'Task Assignment & Tracking',
  },
  {
    id: 'tasks.viewAll',
    label: 'View All Tasks',
    hint: 'Search, audit, and filter tasks across all assignees (FR-TSK-06)',
    group: 'Task Assignment & Tracking',
  },
  {
    id: 'tasks.updateOwn',
    label: 'Update Assigned Tasks',
    hint: 'Update status and upload photo proof of completion (FR-TSK-03, 04)',
    group: 'Task Assignment & Tracking',
  },

  // --- DASHBOARD ---
  {
    id: 'dashboard.birthdays',
    label: 'Dashboard: Birthdays',
    hint: 'Show the Birthdays card on the dashboard',
    group: 'Dashboard',
  },
  {
    id: 'dashboard.hrOverview',
    label: 'Dashboard: Workforce & HR',
    hint: 'Show the Workforce and HR section (new joiners, staff, leaves, holidays) on the dashboard',
    group: 'Dashboard',
  },

  // --- MODULE 3.8: DAILY SITE REPORTS (DSR) ---
  {
    id: 'dsr.submit',
    label: 'Submit Daily Site Report',
    hint: 'Daily work log with mandatory site photos & issues (FR-DSR-01..03)',
    group: 'Daily Site Reports (DSR)',
  },
  {
    id: 'dsr.viewAll',
    label: 'View All DSR Logs',
    hint: 'Daily overview across all sites & missing DSR tracker (FR-DSR-08, 09)',
    group: 'Daily Site Reports (DSR)',
  },
  {
    id: 'dsr.manageClientLink',
    label: 'Curate Client DSR Link',
    hint: 'Select photos & notes visible on client shared link (FR-DSR-07)',
    group: 'Daily Site Reports (DSR)',
  },
  {
    id: 'dsr.viewClientLink',
    label: 'View Shared Client Updates',
    hint: 'Client opens web updates link without logging into app (FR-DSR-05, 06)',
    group: 'Daily Site Reports (DSR)',
  },

  // --- MODULE 3.9 & 3.10: PAYMENTS, LABOUR & EXPENSES ---
  {
    id: 'payments.client.manage',
    label: 'Manage Client Billing',
    hint: 'Set quotation stages, milestone invoices & record payments (FR-PAY-01..04)',
    group: 'Payments, Labour & Billing',
  },
  {
    id: 'payments.client.viewOwn',
    label: 'View Own Client Invoices',
    hint: 'Client portal view of payment milestones & receipts (FR-PAY-05)',
    group: 'Payments, Labour & Billing',
  },
  {
    id: 'payments.labour.manage',
    label: 'Manage Labour & Agency Wages',
    hint: 'Track daily wages, agency contracts, advances & expenses (FR-LAB-01..07)',
    group: 'Payments, Labour & Billing',
  },
  {
    id: 'payments.labour.viewOwn',
    label: 'View Own Wage Records',
    hint: 'Site worker view of own wage logs and advances (SRS 2.2)',
    group: 'Payments, Labour & Billing',
  },

  // --- MODULE 3.11: LEAVE & PAYSLIPS ---
  {
    id: 'leave.apply',
    label: 'Apply for Leave',
    hint: 'Staff submits leave request and checks quota (FR-HR-01, 03)',
    group: 'HR, Leave & Payslips',
  },
  {
    id: 'leave.approve',
    label: 'Approve / Reject Leave',
    hint: 'Manager action to approve or decline staff leave requests (FR-HR-02)',
    group: 'HR, Leave & Payslips',
  },
  {
    id: 'payslips.viewOwn',
    label: 'Download Monthly Payslips',
    hint: 'Staff downloads generated monthly salary slips (FR-HR-06)',
    group: 'HR, Leave & Payslips',
  },

  // --- MODULE 3.12: FILES, PHOTOS & VIDEOS ---
  {
    id: 'files.gallery',
    label: 'Project Photo & Video Gallery',
    hint: 'Cloud gallery of high-resolution site photos and floor plans (FR-STO-01..05)',
    group: 'Cloud Gallery & Storage',
  },

  // --- MODULE 3.13: WEBSITE, CRM LEADS & FEEDBACK ---
  {
    id: 'leads.manage',
    label: 'Manage CRM Website Inquiries',
    hint: 'Track website contact submissions & lead follow-up stages (FR-WEB-02, 03)',
    group: 'Website, CRM & Feedback',
  },
  {
    id: 'feedback.submit',
    label: 'Submit Client Satisfaction Rating',
    hint: 'Homeowner completes handover rating and review (FR-WEB-04)',
    group: 'Website, CRM & Feedback',
  },
  {
    id: 'feedback.view',
    label: 'Review Client Feedback',
    hint: 'Review handover ratings and client comments (FR-WEB-04)',
    group: 'Website, CRM & Feedback',
  },

  // --- MODULE 3.14: REPORTS & ANALYTICS ---
  {
    id: 'reports.view',
    label: 'View Operations Reports',
    hint: 'Access project progress, delays & labour analytics (FR-RPT-01..07)',
    group: 'Reports & Analytics',
  },
  {
    id: 'reports.profitLoss',
    label: 'Profit & Loss Summary',
    hint: 'Executive margin and financial summary (FR-RPT-08)',
    group: 'Reports & Analytics',
  },
  {
    id: 'reports.export',
    label: 'Export Reports (Excel/PDF)',
    hint: 'Download reports and financial data sheets (FR-RPT-10)',
    group: 'Reports & Analytics',
  },
];

/**
 * Default permission matrix mapping (SRS Section 2.2 and Section 3)
 */
export const permissionMatrix = {
  // --- MODULE 3.2: USERS, ROLES & ACCESS ---
  'users.manage': [A],
  'roles.change': [A],

  // --- MODULE 3.3: CLIENT RECORDS ---
  'clients.view': [A, M],
  'clients.manage': [A, M],
  'clients.import': [A, M],

  // --- MODULE 3.4 & 3.5: PROJECTS, ALLOCATION & STAGES ---
  'projects.viewAll': [A, M],
  'projects.viewAssigned': [S, W],
  'projects.viewOwn': [C],
  'projects.create': [A, M],
  'projects.assignPeople': [A, M],
  'agencies.manage': [A, M],
  'stages.editDates': [A, M],
  'stages.editProjectStages': [A, M],
  'stages.updateStatus': [A, M, S],

  // --- MODULE 3.6: ATTENDANCE & GEOFENCING ---
  'attendance.markOwn': [A, M, S, W],
  'attendance.viewBoard': [A, M],
  'attendance.correct': [A, M],
  'geofence.manage': [A, M],

  // --- MODULE 3.7: TASK ASSIGNMENT & TRACKING ---
  'tasks.create': [A, M, S],
  'tasks.createOwn': [W],
  'tasks.viewAll': [A, M],
  'tasks.updateOwn': [A, M, S, W],

  // --- MODULE 3.8: DAILY SITE REPORTS (DSR) ---
  'dashboard.birthdays': [A, M],
  'dashboard.hrOverview': [A, M],
  'dsr.submit': [A, M, S, W],
  'dsr.viewAll': [A, M],
  'dsr.manageClientLink': [A, M],
  'dsr.viewClientLink': [C],

  // --- MODULE 3.9 & 3.10: PAYMENTS, LABOUR & EXPENSES ---
  'payments.client.manage': [A, M],
  'payments.client.viewOwn': [C],
  'payments.labour.manage': [A, M],
  'payments.labour.viewOwn': [W],

  // --- MODULE 3.11: LEAVE & PAYSLIPS ---
  'leave.apply': [A, M, S, W],
  'leave.approve': [A, M],
  'payslips.viewOwn': [A, M, S, W],

  // --- MODULE 3.12: FILES, PHOTOS & VIDEOS ---
  'files.gallery': [A, M],

  // --- MODULE 3.13: WEBSITE, CRM LEADS & FEEDBACK ---
  'leads.manage': [A, M],
  'feedback.submit': [C],
  'feedback.view': [A, M],

  // --- MODULE 3.14: REPORTS & ANALYTICS ---
  'reports.view': [A, M],
  'reports.profitLoss': [A],
  'reports.export': [A, M],
};

const STORAGE_ROLE_GRANTS_KEY = 'osm_role_grants';
const STORAGE_CUSTOM_PERMISSIONS_KEY = 'osm_custom_role_permissions';

/**
 * Derives default role grants dictionary from SRS permissionMatrix
 * @returns {Record<string, string[]>}
 */
export function getDefaultRoleGrants() {
  const allPermKeys = SYSTEM_PERMISSIONS.map((p) => p.id);
  const grants = {
    [ROLES.ADMIN]: allPermKeys,
    [ROLES.MANAGER]: [],
    [ROLES.SUPERVISOR]: [],
    [ROLES.WORKER]: [],
    [ROLES.CLIENT]: [],
  };

  Object.entries(permissionMatrix).forEach(([permKey, allowedRoles]) => {
    allowedRoles.forEach((roleKey) => {
      const normalized = roleKey === 'admin' ? ROLES.ADMIN : roleKey;
      if (!grants[normalized]) {
        grants[normalized] = [];
      }
      if (!grants[normalized].includes(permKey)) {
        grants[normalized].push(permKey);
      }
    });
  });

  return grants;
}

/**
 * Gets the current active role grants (from localStorage or defaults)
 * @returns {Record<string, string[]>}
 */
export function getRoleGrants() {
  try {
    const raw = localStorage.getItem(STORAGE_ROLE_GRANTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Ensure owner has full access
        parsed[ROLES.ADMIN] = SYSTEM_PERMISSIONS.map((p) => p.id);
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read role grants from localStorage', e);
  }

  // Fallback to default canonical grants
  const defaults = getDefaultRoleGrants();

  // Merge any legacy custom permissions
  const legacyCustom = getCustomRolePermissions();
  Object.entries(legacyCustom).forEach(([roleKey, perms]) => {
    defaults[roleKey] = perms;
  });

  return defaults;
}

/**
 * Saves updated role grants to persistence.
 * Also synchronizes the active logged-in user permissions if their role was altered.
 * @param {Record<string, string[]>} newGrants
 */
export function saveRoleGrants(newGrants) {
  const allPermKeys = SYSTEM_PERMISSIONS.map((p) => p.id);
  const sanitized = {
    ...newGrants,
    [ROLES.ADMIN]: allPermKeys, // Super admin always retains full access
  };

  try {
    localStorage.setItem(STORAGE_ROLE_GRANTS_KEY, JSON.stringify(sanitized));

    // Update active user's permissions in localStorage if matching
    const rawUser = localStorage.getItem('osm_auth_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      const userRole = user.role === 'admin' ? ROLES.ADMIN : user.role;
      const updatedUserPerms = sanitized[userRole] || [];
      localStorage.setItem('osm_auth_permissions', JSON.stringify(updatedUserPerms));
    }

    // Broadcast permission update event across app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('osm_permissions_updated', { detail: sanitized })
      );
    }
  } catch (e) {
    console.error('Failed to save role grants to localStorage', e);
  }

  return sanitized;
}

/**
 * Resets role grants to BeForth SRS canonical defaults.
 */
export function resetRoleGrantsToDefault() {
  try {
    localStorage.removeItem(STORAGE_ROLE_GRANTS_KEY);
    const defaults = getDefaultRoleGrants();

    const rawUser = localStorage.getItem('osm_auth_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      const userRole = user.role === 'admin' ? ROLES.ADMIN : user.role;
      const updatedUserPerms = defaults[userRole] || [];
      localStorage.setItem('osm_auth_permissions', JSON.stringify(updatedUserPerms));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('osm_permissions_updated', { detail: defaults })
      );
    }
    return defaults;
  } catch (e) {
    console.error('Failed to reset role grants', e);
    return getDefaultRoleGrants();
  }
}

/**
 * Gets custom role permissions saved by admin.
 * @returns {Record<string, string[]>} Mapping of roleKey -> permissionKeys[]
 */
export function getCustomRolePermissions() {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_PERMISSIONS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read custom role permissions', e);
  }
  return {};
}

/**
 * Saves permissions for a custom role.
 * @param {string} roleKey
 * @param {string[]} permissions
 */
export function saveCustomRolePermissions(roleKey, permissions) {
  const current = getCustomRolePermissions();
  current[roleKey] = permissions;
  try {
    localStorage.setItem(STORAGE_CUSTOM_PERMISSIONS_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to save custom role permissions', e);
  }

  // Also sync to main role grants
  const grants = getRoleGrants();
  grants[roleKey] = permissions;
  saveRoleGrants(grants);

  return current;
}

/**
 * Checks if a specific role has a given permission.
 * Supports built-in roles and dynamic custom roles.
 * @param {string} role
 * @param {string} permissionKey
 * @returns {boolean}
 */
export function hasPermission(role, permissionKey) {
  if (!role || !permissionKey) return false;
  // Normalize 'admin' / 'owner' to ROLES.ADMIN
  const normalizedRole = role === 'admin' ? ROLES.ADMIN : role;

  // Owner/Admin has superuser access to all permissions
  if (normalizedRole === ROLES.ADMIN) {
    return true;
  }

  // Check saved role grants first
  const grants = getRoleGrants();
  if (grants[normalizedRole]) {
    return grants[normalizedRole].includes(permissionKey);
  }

  // Check custom role permissions if applicable
  const customMap = getCustomRolePermissions();
  if (customMap[normalizedRole]) {
    return customMap[normalizedRole].includes(permissionKey);
  }

  const allowedRoles = permissionMatrix[permissionKey];
  if (!allowedRoles) return false;
  return allowedRoles.includes(normalizedRole);
}

/**
 * Derives the list of all permission keys granted to a specific role.
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  if (!role) return [];
  const normalizedRole = role === 'admin' ? ROLES.ADMIN : role;

  // Owner/Admin receives all system permissions
  if (normalizedRole === ROLES.ADMIN) {
    return SYSTEM_PERMISSIONS.map((p) => p.id);
  }

  const grants = getRoleGrants();
  if (grants[normalizedRole]) {
    return grants[normalizedRole];
  }

  const customMap = getCustomRolePermissions();
  if (customMap[normalizedRole]) {
    return customMap[normalizedRole];
  }

  return Object.entries(permissionMatrix)
    .filter(([_, allowedRoles]) => allowedRoles.includes(normalizedRole))
    .map(([perm]) => perm);
}

export default permissionMatrix;
