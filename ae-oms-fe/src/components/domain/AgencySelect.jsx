import React from 'react';
import Select from '../ui/Select';

/**
 * Dropdown selector for subcontractor agencies with trade scope indicators.
 *
 * @param {Object} props
 * @param {string} [props.label='Select Agency']
 * @param {Array<Object>} props.agencies
 * @param {string} props.value - Selected agencyId
 * @param {function(string): void} props.onChange
 * @param {string} [props.tradeFilter]
 * @param {string} [props.placeholder='Choose agency...']
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {boolean} [props.includeInternal=true] - Allows 'Internal Site Crew' option
 */
export function AgencySelect({
  label = 'Select Agency',
  agencies = [],
  value = '',
  onChange,
  tradeFilter,
  placeholder = 'Choose agency...',
  error,
  helperText,
  includeInternal = true,
}) {
  const filteredAgencies = tradeFilter
    ? agencies.filter(
        (a) =>
          !a.trade ||
          a.trade.toLowerCase().includes(tradeFilter.toLowerCase()) ||
          tradeFilter.toLowerCase().includes(a.trade.toLowerCase())
      )
    : agencies;

  const options = [
    ...(includeInternal
      ? [{ value: 'internal', label: 'Internal Site Crew (In-house)' }]
      : []),
    ...filteredAgencies.map((a) => ({
      value: a.id,
      label: `${a.name} (${a.trade})`,
    })),
  ];

  return (
    <Select
      label={label}
      options={options}
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      error={error}
      helperText={helperText}
    />
  );
}

export default AgencySelect;
