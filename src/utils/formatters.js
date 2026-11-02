/**
 * Utility functions for formatting currency (INR), dates, and strings.
 */

/**
 * Formats a number as Indian Rupee (INR) currency with Indian grouping (e.g. ₹1,20,000).
 * @param {number|string} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const clean = String(amount ?? '').replace(/,/g, '').trim();
  if (amount === null || amount === undefined || isNaN(Number(clean)) || clean === '') {
    return '₹0';
  }
  const numeric = Math.round(Number(clean));
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numeric);
}

/**
 * Formats a date string or Date object into 'DD MMM YYYY' format (e.g. 19 Oct 2026).
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatDate(dateInput) {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Extracts initials from a user's full name (up to 2 letters).
 * @param {string} name
 * @returns {string}
 */
export function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Combines class names conditionally.
 * @param  {...any} classes
 * @returns {string}
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Formats a raw number or numeric string with commas for numbers >= 1,000 using Indian grouping (e.g. 15000000 -> 1,50,00,000).
 * Preserves decimals if present.
 * @param {number|string} value
 * @returns {string}
 */
export function formatNumberWithCommas(value) {
  if (value === null || value === undefined || value === '') return '';
  const str = String(value).trim();
  if (str === '-') return '-';

  const clean = str.replace(/,/g, '');
  const parts = clean.split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';

  if (integerPart === '' || integerPart === '-') return str;
  if (isNaN(Number(integerPart))) return str;

  const isNegative = integerPart.startsWith('-');
  const absInt = isNegative ? integerPart.slice(1) : integerPart;

  if (!absInt) return isNegative ? '-' : '';

  const numVal = Number(absInt);
  const formattedInt = numVal.toLocaleString('en-IN');
  return `${isNegative ? '-' : ''}${formattedInt}${decimalPart}`;
}

export const formatNumber = formatNumberWithCommas;

/**
 * Strips commas from a formatted numeric string to get a clean number.
 * @param {string|number} value
 * @returns {string}
 */
export function cleanNumber(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/,/g, '').trim();
}

export function parseDateSafe(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? null : d;
}
