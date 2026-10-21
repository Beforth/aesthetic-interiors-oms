/**
 * 12 default stages of execution in strict chronological order for interior fit-out projects.
 * Stored separately as a master template so editing it affects only NEW projects.
 */
export const defaultStageTemplate = [
  {
    order: 1,
    name: 'Cleaning',
    description: 'Initial site clearance, debris removal, baseline floor level preparation',
    durationDays: 4,
    defaultAgencyTrade: 'Cleaning',
  },
  {
    order: 2,
    name: 'Ceiling',
    description: 'False ceiling framing, GI channels, gypsum boards, coves, access traps',
    durationDays: 12,
    defaultAgencyTrade: 'Ceiling',
  },
  {
    order: 3,
    name: 'Carpenter',
    description: 'Carcass assembly, modular boxes, plywood boxing, laminate pressing, wardrobes',
    durationDays: 20,
    defaultAgencyTrade: 'Carpenter',
  },
  {
    order: 4,
    name: 'Tiles',
    description: 'Floor and wall tile laying, bathroom dados, grouting, marble skirting',
    durationDays: 10,
    defaultAgencyTrade: 'Tiles',
  },
  {
    order: 5,
    name: 'Plumbing',
    description: 'Concealed piping, diverters, sanitaryware installations, pressure testing',
    durationDays: 8,
    defaultAgencyTrade: 'Plumbing',
  },
  {
    order: 6,
    name: 'Electrical',
    description: 'Wiring chase, switchboard fixtures, architectural light fittings, conduit lines',
    durationDays: 10,
    defaultAgencyTrade: 'Electrical',
  },
  {
    order: 7,
    name: 'Glass agencies',
    description: 'Toughened glass partitions, shower cubicles, mirrors, fluted glass panels',
    durationDays: 7,
    defaultAgencyTrade: 'Glass',
  },
  {
    order: 8,
    name: 'Finishing (wallpaper, curtains and similar)',
    description: 'Designer wallpapers, acoustic fabric, motorized blinds, soft furnishings',
    durationDays: 8,
    defaultAgencyTrade: 'Finishing',
  },
  {
    order: 9,
    name: 'Fabrication',
    description: 'MS metal framing, powder-coated partition screens, brass accents, hardware',
    durationDays: 8,
    defaultAgencyTrade: 'Fabrication',
  },
  {
    order: 10,
    name: 'Civil work',
    description: 'Wall modifications, niche plastering, door frame granite packing, core cuts',
    durationDays: 10,
    defaultAgencyTrade: 'Civil',
  },
  {
    order: 11,
    name: 'Artistic work',
    description: 'Texture paint accents, custom wall murals, fluting, bespoke design motifs',
    durationDays: 6,
    defaultAgencyTrade: 'Artistic',
  },
  {
    order: 12,
    name: 'Painter',
    description: 'Putty, 2 coats primer, final luxury emulsion roller coats, touchups',
    durationDays: 14,
    defaultAgencyTrade: 'Paint',
  },
];

export default defaultStageTemplate;
