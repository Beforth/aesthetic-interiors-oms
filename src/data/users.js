import { ROLES } from '../config/roles';

/**
 * Aesthetic Interiors OMS - Authorized Personnel & Client Directory
 *
 * Current Active Records:
 * 1. Rohit Kumar    | Owner (Admin)   | password: admin123
 * 2. Neha Kulkarni   | Manager         | password: demo123 (Birthday: Oct 24)
 * 3. Vikram Jadhav   | Site Supervisor | password: demo123 (Birthday: Oct 15)
 * 4. Suresh Gaikwad  | Site Worker     | password: demo123 (Birthday: Oct 28)
 * 5. Amit Joshi      | Client          | password: demo123 (Birthday: Oct 03)
 */
export const mockUsers = [
  {
    id: 'u1',
    name: 'Rohit Kumar',
    role: ROLES.ADMIN, // 'owner'
    email: 'rohit@aesthetic.demo',
    username: 'rohit',
    password: 'admin123',
    phone: '+91 98201 11223',
    status: 'active',
    joinedOn: '2023-01-10',
    birthday: '1985-11-12',
    title: 'Managing Director & Owner',
    notes: 'owner',
    assignedProjects: ['P1', 'P2', 'P3', 'P4'],
  },
  {
    id: 'u2',
    name: 'Neha Kulkarni',
    role: ROLES.MANAGER,
    email: 'neha@aesthetic.demo',
    username: 'neha',
    password: 'demo123',
    phone: '+91 98451 22334',
    status: 'active',
    joinedOn: '2023-03-15',
    birthday: '1992-10-24',
    title: 'Senior Operations Manager',
    notes: 'runs projects & operations',
    assignedProjects: ['P1', 'P2', 'P3', 'P4'],
  },
  {
    id: 'u3',
    name: 'Vikram Jadhav',
    role: ROLES.SUPERVISOR,
    email: 'vikram@aesthetic.demo',
    username: 'vikram',
    password: 'demo123',
    phone: '+91 94220 44556',
    status: 'active',
    joinedOn: '2023-08-12',
    birthday: '1990-10-15',
    title: 'Site Supervisor',
    notes: 'field site supervisor',
    assignedProjects: ['P1', 'P2', 'P3', 'P4'],
  },
  {
    id: 'u4',
    name: 'Suresh Gaikwad',
    role: ROLES.WORKER,
    email: 'suresh@aesthetic.demo',
    username: 'suresh',
    password: 'demo123',
    phone: '+91 97411 77889',
    status: 'active',
    joinedOn: '2024-03-01',
    birthday: '1994-10-28',
    title: 'Site Worker',
    notes: 'lead site craftsman & artisan',
    assignedProjects: ['P1', 'P2', 'P3', 'P4'],
  },
  {
    id: 'u5',
    name: 'Amit Joshi',
    role: ROLES.CLIENT,
    email: 'amit@client.demo',
    username: 'amit',
    password: 'demo123',
    phone: '+91 99000 11002',
    status: 'active',
    joinedOn: '2024-05-20',
    birthday: '1982-10-03',
    title: 'Client',
    notes: 'project client & property owner',
    assignedProjects: ['P1', 'P2', 'P3', 'P4'],
  },
];

export default mockUsers;
