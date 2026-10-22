import React from 'react';
import MultiSelect from '../ui/MultiSelect';
import { ROLE_LABELS } from '../../config/roles';

/**
 * Assignee picker allowing multi-assignment of site supervisors and artisans.
 * Composes MultiSelect with role metadata and user avatar badges.
 *
 * @param {Object} props
 * @param {string} [props.label='Assign Team']
 * @param {Array<Object>} props.users - List of candidate users
 * @param {Array<string>} props.value - Selected user IDs
 * @param {function(Array<string>): void} props.onChange
 * @param {string} [props.roleFilter] - Optional filter for specific role (e.g. 'supervisor' or 'worker')
 * @param {string} [props.placeholder='Select personnel...']
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 */
export function AssigneePicker({
  label = 'Assign Team',
  users = [],
  value = [],
  onChange,
  roleFilter,
  placeholder = 'Select personnel...',
  error,
  helperText,
}) {
  const filteredUsers = roleFilter
    ? users.filter((u) => u.role === roleFilter)
    : users;

  const options = filteredUsers.map((u) => ({
    value: u.id,
    label: u.name,
    subtitle: `${ROLE_LABELS[u.role] || u.role} • ${u.title || u.notes || ''}`,
  }));

  return (
    <MultiSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      error={error}
      helperText={helperText}
    />
  );
}

export default AssigneePicker;
