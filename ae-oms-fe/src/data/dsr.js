/**
 * Aesthetic Interiors OMS - SRS Section 3.8: Daily Site Reports (DSR) Data
 */

export const mockDsrLogs = [
  {
    id: 'dsr-101',
    projectId: 'P1',
    projectName: 'Indiranagar 4BHK Luxury Villa',
    stageId: 's-ceiling',
    stageName: 'False Ceiling & POP Works',
    authorId: 'u3',
    authorName: 'Vikram Jadhav',
    authorRole: 'Site Supervisor',
    date: new Date().toISOString().split('T')[0],
    submissionTime: '06:15 PM',
    type: 'site', // 'site' | 'office'
    workDone: 'Completed master bedroom perimeter shadow groove false ceiling framing. 12mm Saint-Gobain moisture-resistant gypsum boards fixed. Electrical conduit drop inspection verified with client drawing.',
    manpowerCount: 6,
    materialArrivals: '40 sheets Saint-Gobain gypsum boards, 3 boxes drywall screws (delivered 02:30 PM)',
    photos: [
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&auto=format&fit=crop&q=80',
    ],
    showOnClientLink: true, // FR-DSR-07: Manager controls client link visibility
    clientFeedback: 'Looking very clean Vikram, thanks for sharing photos promptly!',
  },
  {
    id: 'dsr-102',
    projectId: 'P2',
    projectName: 'HSR Layout Contemporary 3BHK',
    stageId: 's-electrical',
    stageName: 'Electrical Conduit & Wiring',
    authorId: 'u3',
    authorName: 'Vikram Jadhav',
    authorRole: 'Site Supervisor',
    date: new Date().toISOString().split('T')[0],
    submissionTime: '06:40 PM',
    type: 'site',
    workDone: 'Living room home-theatre conduit chasing completed. Kitchen island point rerouted per revised client island counter location. DB dressing completed.',
    manpowerCount: 4,
    materialArrivals: 'Polycab 2.5 sq mm fire-resistant wire coils (3 green, 3 red)',
    photos: [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
    ],
    showOnClientLink: true,
    clientFeedback: null,
  },
  {
    id: 'dsr-103',
    projectId: 'P4',
    projectName: 'Lavelle Road Commercial Studio',
    stageId: 's-design',
    stageName: '3D Render & Material Spec Finalization',
    authorId: 'u2',
    authorName: 'Neha Kulkarni',
    authorRole: 'Senior Operations Manager',
    date: new Date().toISOString().split('T')[0],
    submissionTime: '05:30 PM',
    type: 'office', // Office employee submits without photos (FR-DSR-03)
    workDone: 'Detailed BOQ sign-off meeting with corporate tenant team. Finalized acoustic fabric wall panel shades with architect.',
    manpowerCount: 2,
    materialArrivals: 'Imported veneer sample catalogue arrived from distributor',
    photos: [],
    showOnClientLink: true,
    clientFeedback: 'Approved the veneer selection.',
  },
];

// Employees missing DSR today (FR-DSR-09)
export const mockMissingDsrEmployees = [
  {
    id: 'u4',
    name: 'Suresh Gaikwad',
    role: 'Site Worker / Artisan Lead',
    assignedSite: 'Indiranagar 4BHK Luxury Villa',
    punchedInAt: '08:30 AM',
    status: 'pending_dsr',
  },
];
