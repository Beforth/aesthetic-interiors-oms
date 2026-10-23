/**
 * Daily Status Report: demo entries until the DSR tab is wired to the backend.
 *
 * One entry is one piece of work a person logged for a day. `minutes` is the time spent.
 * `auto` marks entries created from a completed ticket rather than typed in by hand.
 */

export const DSR_CATEGORIES = [
  'Site Visit',
  'Client Meeting',
  'Design Work',
  'Review & Approval',
  'Planning',
  'Other',
];

export const DSR_STATUSES = [
  { value: 'completed', label: 'Completed' },
  { value: 'in progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
];

export const NO_PROJECT = 'No project';

export const DSR_PROJECTS = [
  NO_PROJECT,
  'Indiranagar 4BHK Luxury Villa',
  'HSR Layout Contemporary 3BHK',
  'Lavelle Road Commercial Studio',
  'Aesthetic Interior - OMS',
];

const PEOPLE = {
  rohit: { authorId: 'u1', authorName: 'Rohit Kumar', authorRole: 'Owner' },
  neha: { authorId: 'u2', authorName: 'Neha Kulkarni', authorRole: 'Manager' },
  vikram: { authorId: 'u3', authorName: 'Vikram Jadhav', authorRole: 'Site Supervisor' },
  suresh: { authorId: 'u4', authorName: 'Suresh Gaikwad', authorRole: 'Site Worker' },
};

/** Local calendar date (YYYY-MM-DD) `daysAgo` days before today; never UTC, so it matches the user's day. */
export function dateDaysAgo(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const entry = (id, daysAgo, who, task, project, category, minutes, status, extra = {}) => ({
  id,
  date: dateDaysAgo(daysAgo),
  ...PEOPLE[who],
  task,
  project,
  category,
  minutes,
  status,
  note: '',
  auto: false,
  ...extra,
});

export const mockDsrEntries = [
  // today
  entry('dsr-1', 0, 'rohit', 'Reviewed vendor quotations for the Lavelle Road studio', 'Lavelle Road Commercial Studio', 'Review & Approval', 60, 'completed'),
  entry('dsr-2', 0, 'rohit', 'Weekly planning call with managers', NO_PROJECT, 'Planning', 45, 'completed'),
  entry('dsr-3', 0, 'neha', 'BOQ sign-off meeting with the corporate tenant team', 'Lavelle Road Commercial Studio', 'Client Meeting', 90, 'completed', { note: 'Veneer shade approved' }),
  entry('dsr-4', 0, 'neha', 'Finalised acoustic wall panel shades with the architect', 'Lavelle Road Commercial Studio', 'Design Work', 75, 'in progress'),
  entry('dsr-5', 0, 'vikram', 'False ceiling framing for the master bedroom, gypsum boards fixed', 'Indiranagar 4BHK Luxury Villa', 'Site Visit', 240, 'completed', { note: '6 workers on site' }),
  entry('dsr-6', 0, 'vikram', 'Electrical conduit chasing in the living room', 'HSR Layout Contemporary 3BHK', 'Site Visit', 120, 'in progress'),
  entry('dsr-7', 0, 'suresh', 'Perimeter shadow groove work', 'Indiranagar 4BHK Luxury Villa', 'Site Visit', 300, 'completed'),
  entry('dsr-8', 0, 'rohit', '[AEIO-003] Backend foundations, custom user model and roles', 'Aesthetic Interior - OMS', 'Other', 15, 'completed', { auto: true }),
  // yesterday
  entry('dsr-9', 1, 'rohit', 'Approved the revised payment schedule', 'HSR Layout Contemporary 3BHK', 'Review & Approval', 30, 'completed'),
  entry('dsr-10', 1, 'neha', 'Site inspection with the client, snag list prepared', 'Indiranagar 4BHK Luxury Villa', 'Site Visit', 150, 'completed'),
  entry('dsr-11', 1, 'vikram', 'Kitchen island point rerouted as per the revised layout', 'HSR Layout Contemporary 3BHK', 'Site Visit', 180, 'completed'),
  entry('dsr-12', 1, 'suresh', 'Waiting for gypsum board delivery, work stopped', 'Indiranagar 4BHK Luxury Villa', 'Site Visit', 60, 'blocked', { note: 'Supplier delayed by a day' }),
  // 2-6 days ago
  entry('dsr-13', 2, 'neha', '3D render review for the living room', 'Lavelle Road Commercial Studio', 'Design Work', 120, 'completed'),
  entry('dsr-14', 2, 'vikram', 'DB dressing and testing', 'HSR Layout Contemporary 3BHK', 'Site Visit', 210, 'completed'),
  entry('dsr-15', 3, 'rohit', 'Client call about the Indiranagar handover date', 'Indiranagar 4BHK Luxury Villa', 'Client Meeting', 40, 'completed'),
  entry('dsr-16', 3, 'suresh', 'Material unloading and storage', 'Indiranagar 4BHK Luxury Villa', 'Other', 90, 'completed'),
  entry('dsr-17', 4, 'neha', 'Vendor negotiation for tiles', 'HSR Layout Contemporary 3BHK', 'Planning', 100, 'completed'),
  entry('dsr-18', 5, 'vikram', 'Stage hand-over checklist for civil work', 'Indiranagar 4BHK Luxury Villa', 'Review & Approval', 80, 'completed'),
  entry('dsr-19', 6, 'rohit', '[AEIO-002] Monorepo setup, Docker and Postgres', 'Aesthetic Interior - OMS', 'Other', 15, 'completed', { auto: true }),
  entry('dsr-20', 6, 'suresh', 'Floor protection and cleaning', 'HSR Layout Contemporary 3BHK', 'Other', 120, 'completed'),
  // older
  entry('dsr-21', 9, 'neha', 'Monthly vendor performance review', NO_PROJECT, 'Review & Approval', 90, 'completed'),
  entry('dsr-22', 12, 'vikram', 'Material check against the BOQ', 'Indiranagar 4BHK Luxury Villa', 'Site Visit', 130, 'completed'),
  entry('dsr-23', 15, 'rohit', 'Quarterly planning with the owner group', NO_PROJECT, 'Planning', 120, 'completed'),
  entry('dsr-24', 24, 'suresh', 'Scaffolding set-up for the double-height ceiling', 'Indiranagar 4BHK Luxury Villa', 'Site Visit', 270, 'completed'),
  entry('dsr-25', 40, 'neha', 'Kick-off meeting for the Lavelle Road project', 'Lavelle Road Commercial Studio', 'Client Meeting', 60, 'completed'),
];
