// The default export must be StatusBadge itself. Re-exporting Badge's default here rendered the generic
// Badge, which ignores `status` and showed an empty pill on every page that imports it by default.
export { StatusBadge } from './Badge';
export { StatusBadge as default } from './Badge';
