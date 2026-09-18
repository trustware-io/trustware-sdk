/**
 * True when `value` is 2^k for some integer k (…, 0.25, 0.5, 1, 2, 4, 8, …).
 * Drives the success-screen easter egg. Tolerates float noise from decimal
 * parsing so "0.125" and 0.5 * 0.25 both count; 0, negatives, NaN and
 * Infinity never do.
 */
export function isPowerOfTwo(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  const exponent = Math.log2(value);
  return Math.abs(exponent - Math.round(exponent)) < 1e-9;
}
