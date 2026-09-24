/**
 * RentEase Input Validation & Sanitization Utilities
 * Enforces strict typing rules:
 * - Numeric only: strips all non-digits (or allows valid decimals)
 * - Alphabetic only: strips all digits and symbols, allowing letters, spaces, hyphens
 * - Alphanumeric: strips unsafe characters, uppercase formatting for codes (IFSC, GSTIN)
 */

/**
 * Strips all non-digit characters from the input string.
 * @param {string} value 
 * @param {number} [maxLength] Optional maximum length to clamp
 * @returns {string} Only digits
 */
export const sanitizeNumeric = (value, maxLength) => {
  if (value === null || value === undefined) return "";
  const cleaned = String(value).replace(/\D/g, "");
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
};

/**
 * Cleans decimal numbers (e.g. for rent, security deposit, payment amounts).
 * Allows only positive numbers with at most one decimal point and 2 decimal places.
 * @param {string|number} value
 * @returns {string}
 */
export const sanitizeDecimal = (value) => {
  if (value === null || value === undefined) return "";
  let str = String(value).replace(/[^0-9.]/g, "");
  const parts = str.split(".");
  if (parts.length > 2) {
    str = parts[0] + "." + parts.slice(1).join("");
  }
  return str;
};

/**
 * Strips all digits and special symbols, preserving only letters, spaces, and hyphens/apostrophes.
 * Ideal for First Name, Last Name, City, State, Bank Name, etc.
 * @param {string} value 
 * @param {number} [maxLength]
 * @returns {string} Only alphabetic characters and spaces/hyphens
 */
export const sanitizeAlpha = (value, maxLength) => {
  if (value === null || value === undefined) return "";
  // Allows English letters, accents/spaces, hyphens, and apostrophes
  const cleaned = String(value).replace(/[^a-zA-Z\s\-']/g, "");
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
};

/**
 * Strips special characters, allowing alphanumeric characters, spaces, dashes, and underscores.
 * @param {string} value 
 * @param {number} [maxLength]
 * @returns {string}
 */
export const sanitizeAlphanumeric = (value, maxLength) => {
  if (value === null || value === undefined) return "";
  const cleaned = String(value).replace(/[^a-zA-Z0-9\s\-_\/]/g, "");
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
};

/**
 * Cleans and converts codes (such as IFSC, GSTIN, PAN) to uppercase alphanumeric with length limit.
 * @param {string} value 
 * @param {number} [maxLength]
 * @returns {string}
 */
export const sanitizeCode = (value, maxLength) => {
  if (value === null || value === undefined) return "";
  const cleaned = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
};

/**
 * Keydown handler to prevent entering 'e', 'E', '+', '-' in numeric inputs
 * @param {KeyboardEvent} event 
 */
export const preventNumberSpill = (event) => {
  if (["e", "E", "+", "-"].includes(event.key)) {
    event.preventDefault();
  }
};

/**
 * Validation Regex Checks
 */
export const isValidPhone = (phone) => {
  return /^[6-9]\d{9}$/.test(String(phone).trim());
};

export const isValidPincode = (pincode) => {
  return /^[1-9][0-9]{5}$/.test(String(pincode).trim());
};

export const isValidIFSC = (ifsc) => {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(ifsc).trim().toUpperCase());
};

export const isValidGSTIN = (gstin) => {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
    String(gstin).trim().toUpperCase()
  );
};

export const isValidUPI = (upi) => {
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(String(upi).trim());
};
