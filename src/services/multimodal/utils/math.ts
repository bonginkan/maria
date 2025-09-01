/**
 * Safe mathematical operations that handle edge cases
 */

/**
 * Calculate average safely, handling empty arrays and NaN/Infinity
 * @param values Array of numbers to average
 * @returns Safe average value (0 for edge cases)
 */
export function safeAverage(values: number[]): number {
  if (values.length === 0) return 0;

  // Filter out non-finite values
  const validValues = values.filter((v) => Number.isFinite(v));
  if (validValues.length === 0) return 0;

  const sum = validValues.reduce((s, v) => s + v, 0);
  const avg = sum / validValues.length;

  // Final safety check
  return Number.isNaN(avg) || !Number.isFinite(avg) ? 0 : avg;
}

/**
 * Calculate percentile safely
 * @param values Array of numbers
 * @param percentile Percentile to calculate (0-100)
 * @returns Safe percentile value
 */
export function safePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (percentile < 0 || percentile > 100) {
    throw new Error(
      `Invalid percentile: ${percentile}. Must be between 0 and 100.`,
    );
  }

  // Filter and sort
  const validValues = values.filter((v) => Number.isFinite(v));
  if (validValues.length === 0) return 0;

  const sorted = [...validValues].sort((a, b) => a - b);

  // Calculate index
  if (percentile === 0) return sorted[0];
  if (percentile === 100) return sorted[sorted.length - 1];

  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  // Interpolate if necessary
  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate standard deviation safely
 * @param values Array of numbers
 * @returns Safe standard deviation
 */
export function safeStandardDeviation(values: number[]): number {
  const mean = safeAverage(values);
  if (values.length <= 1) return 0;

  const validValues = values.filter((v) => Number.isFinite(v));
  if (validValues.length <= 1) return 0;

  const squaredDiffs = validValues.map((v) => Math.pow(v - mean, 2));
  const variance = safeAverage(squaredDiffs);

  return Math.sqrt(variance);
}

/**
 * Calculate sum safely
 * @param values Array of numbers
 * @returns Safe sum (0 for empty or all-invalid arrays)
 */
export function safeSum(values: number[]): number {
  if (values.length === 0) return 0;

  return values.reduce((sum, v) => {
    if (Number.isFinite(v)) {
      return sum + v;
    }
    return sum;
  }, 0);
}

/**
 * Calculate min safely
 * @param values Array of numbers
 * @returns Safe minimum value (Infinity for empty arrays)
 */
export function safeMin(values: number[]): number {
  const validValues = values.filter((v) => Number.isFinite(v));
  if (validValues.length === 0) return Infinity;
  return Math.min(...validValues);
}

/**
 * Calculate max safely
 * @param values Array of numbers
 * @returns Safe maximum value (-Infinity for empty arrays)
 */
export function safeMax(values: number[]): number {
  const validValues = values.filter((v) => Number.isFinite(v));
  if (validValues.length === 0) return -Infinity;
  return Math.max(...validValues);
}
