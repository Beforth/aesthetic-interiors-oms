/**
 * Aesthetic Interiors OMS - Centralized Form Validation Library
 * Handles strict validation for phone (10 digits), email (@ symbol & domain),
 * positive amounts, dates, URLs, and required fields across all screens.
 */

/**
 * Validates a 10-digit mobile phone number.
 * Allows standard Indian 10-digit numbers (optionally formatted with +91, spaces, or hyphens).
 */
export function validatePhone(phone, { required = true, fieldLabel = 'Phone number' } = {}) {
  const raw = String(phone || '').trim();
  if (!raw) {
    return required ? `${fieldLabel} is required` : null;
  }

  // Strip international code (+91), spaces, dashes, parentheses
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (digits.length === 0) {
    return `${fieldLabel} must contain numbers only`;
  }

  if (digits.length < 10) {
    return `${fieldLabel} must be exactly 10 digits (currently ${digits.length})`;
  }

  if (digits.length > 10) {
    return `${fieldLabel} cannot exceed 10 digits`;
  }

  // Indian mobile numbers typically start with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return `${fieldLabel} must start with 6, 7, 8, or 9 (e.g. 9845012345)`;
  }

  return null;
}

/**
 * Helper to sanitize phone input as user types: removes non-digits and limits to 10 digits.
 */
export function sanitizePhone(val) {
  if (!val) return '';
  const digitsOnly = String(val).replace(/\D/g, '');
  // If user pastes with 91 prefix
  if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
    return digitsOnly.slice(2, 12);
  }
  return digitsOnly.slice(0, 10);
}

/**
 * Validates email address requiring '@' symbol and valid domain.
 */
export function validateEmail(email, { required = true, fieldLabel = 'Email address' } = {}) {
  const val = String(email || '').trim();
  if (!val) {
    return required ? `${fieldLabel} is required` : null;
  }

  if (!val.includes('@')) {
    return `${fieldLabel} must contain "@" symbol (e.g. name@domain.com)`;
  }

  const parts = val.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return `${fieldLabel} is incomplete (missing username or domain)`;
  }

  if (!parts[1].includes('.')) {
    return `${fieldLabel} must have a valid domain extension (e.g. .com, .in)`;
  }

  // Standard RFC 5322 email regex check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
  if (!emailRegex.test(val)) {
    return 'Please enter a valid email format (e.g. contact@aesthetic.demo)';
  }

  return null;
}

/**
 * Validates required text string.
 */
export function validateRequired(value, fieldLabel = 'This field', minLength = 1) {
  const str = String(value ?? '').trim();
  if (!str) {
    return `${fieldLabel} is required`;
  }
  if (str.length < minLength) {
    return `${fieldLabel} must be at least ${minLength} characters`;
  }
  return null;
}

/**
 * Validates positive currency / numerical amount.
 */
export function validatePositiveNumber(
  value,
  fieldLabel = 'Amount',
  { min = 1, max = 1000000000, required = true } = {}
) {
  const str = String(value ?? '').trim();
  if (!str) {
    return required ? `${fieldLabel} is required` : null;
  }

  const num = Number(str);
  if (isNaN(num)) {
    return `${fieldLabel} must be a valid number`;
  }

  if (num < min) {
    return `${fieldLabel} must be at least ₹${min.toLocaleString('en-IN')}`;
  }

  if (num > max) {
    return `${fieldLabel} cannot exceed ₹${max.toLocaleString('en-IN')}`;
  }

  return null;
}

/**
 * Validates Indian 6-digit postal code.
 */
export function validatePincode(pincode, { required = false } = {}) {
  const val = String(pincode || '').trim();
  if (!val) {
    return required ? 'Pincode is required' : null;
  }
  if (!/^\d{6}$/.test(val)) {
    return 'Pincode must be exactly 6 numeric digits';
  }
  return null;
}

/**
 * Validates password strength and minimum length.
 */
export function validatePassword(password, { minLength = 4, required = true } = {}) {
  const val = String(password || '');
  if (!val) {
    return required ? 'Password is required' : null;
  }
  if (val.length < minLength) {
    return `Password must be at least ${minLength} characters long`;
  }
  return null;
}

/**
 * Validates that End Date is equal to or after Start Date.
 */
export function validateDateRange(startDate, endDate, { startLabel = 'Start date', endLabel = 'End date' } = {}) {
  if (!startDate) return `${startLabel} is required`;
  if (!endDate) return `${endLabel} is required`;

  const s = new Date(startDate);
  const e = new Date(endDate);

  if (isNaN(s.getTime())) return `Invalid ${startLabel.toLowerCase()}`;
  if (isNaN(e.getTime())) return `Invalid ${endLabel.toLowerCase()}`;

  if (e < s) {
    return `${endLabel} cannot be before ${startLabel.toLowerCase()}`;
  }

  return null;
}

/**
 * Validates web URL format.
 */
export function validateUrl(url, { required = true, fieldLabel = 'URL' } = {}) {
  const val = String(url || '').trim();
  if (!val) {
    return required ? `${fieldLabel} is required` : null;
  }
  try {
    const parsed = new URL(val);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return `${fieldLabel} must start with http:// or https://`;
    }
  } catch {
    return `Please enter a valid web URL (e.g. https://example.com/photo.jpg)`;
  }
  return null;
}

/**
 * Validates GPS coordinates.
 */
export function validateGpsCoordinates(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);

  if (isNaN(nLat) || nLat < -90 || nLat > 90) {
    return 'Latitude must be between -90 and 90 degrees';
  }
  if (isNaN(nLng) || nLng < -180 || nLng > 180) {
    return 'Longitude must be between -180 and 180 degrees';
  }
  return null;
}

export default {
  validatePhone,
  sanitizePhone,
  validateEmail,
  validateRequired,
  validatePositiveNumber,
  validatePincode,
  validatePassword,
  validateDateRange,
  validateUrl,
  validateGpsCoordinates,
};
