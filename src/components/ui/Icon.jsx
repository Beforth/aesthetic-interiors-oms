import React from 'react';
import iconMap from '../../config/iconMap';

/**
 * Universal Icon wrapper around lucide-react.
 * All icons across the application go through this component.
 *
 * @param {Object} props
 * @param {string} props.name - Name key matching iconMap
 * @param {number|string} [props.size=18] - Icon size in pixels
 * @param {string} [props.color] - Optional inline color or stroke
 * @param {string} [props.className] - Additional Tailwind classes
 * @param {string} [props.ariaLabel] - Accessible label for icon
 */
export function Icon({
  name,
  size = 18,
  color,
  className = '',
  ariaLabel,
  ...rest
}) {
  const IconComponent = iconMap[name];
  if (!IconComponent) return null;

  return (
    <IconComponent
      size={size}
      color={color}
      className={className}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      {...rest}
    />
  );
}

export default Icon;
