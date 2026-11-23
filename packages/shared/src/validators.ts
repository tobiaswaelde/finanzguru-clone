/** Check the ISO 13616 checksum of an IBAN after removing display whitespace. */
export function isValidIban(value: string): boolean {
  const normalized = value.replace(/\s/gu, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/u.test(normalized)) return false;
  if (normalized.startsWith('DE') && !/^DE\d{20}$/u.test(normalized)) return false;
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digit = char.charCodeAt(0);
    remainder = digit >= 65 ? (remainder * 100 + digit - 55) % 97 : (remainder * 10 + digit - 48) % 97;
  }
  return remainder === 1;
}

/** Check the ISIN format and ISO 6166 Luhn check digit. */
export function isValidIsin(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/u.test(normalized)) return false;
  let expanded = '';
  for (const char of normalized) {
    expanded += char >= 'A' ? String(char.charCodeAt(0) - 55) : char;
  }
  let sum = 0;
  for (let index = expanded.length - 1; index >= 0; index--) {
    const digit = expanded.charCodeAt(index) - 48;
    const doubled = (expanded.length - index) % 2 === 0 ? digit * 2 : digit;
    sum += doubled > 9 ? doubled - 9 : doubled;
  }
  return sum % 10 === 0;
}
