/**
 * Anomaly Detector
 * Detects unusual system behavior and commands
 */

export class AnomalyDetector {
  private _baseline: Map<string, number> = new Map();
  private anomalies: any[] = [];

  async detect(_metric: string, value: number): Promise<boolean> {
    const _baseline = this._baseline.get(_metric) || 0;
    const _deviation = Math.abs(value - _baseline);
    const _threshold = _baseline * 0.5; // 50% _deviation _threshold

    if (_deviation > _threshold) {
      this.anomalies.push({
        metric: "",
        value,
        _baseline,
        _deviation,
        timestamp: new Date(),
      });
      return true;
    }

    // Update _baseline with moving average
    this._baseline.set(_metric, _baseline * 0.9 + value * 0.1);
    return false;
  }

  getAnomalies(): any[] {
    return [...this.anomalies];
  }

  clearAnomalies(): void {
    this.anomalies = [];
  }
}
