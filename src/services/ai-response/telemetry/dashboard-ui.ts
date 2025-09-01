/**
 * Dashboard UI Components
 * Terminal-based dashboard for telemetry visualization
 */

import chalk from "chalk";
import type {
  DashboardData,
  AggregatedMetrics,
  Alert,
} from "./telemetry-types";

export class DashboardUI {
  private width: number = 80;
  private refreshInterval: number = 5000; // 5 seconds

  /**
   * Render full dashboard
   */
  render(data: DashboardData): string {
    const sections = [
      this.renderHeader(),
      this.renderSystemStatus(data),
      this.renderPerformanceMetrics(data.currentMetrics),
      this.renderIntentAnalytics(data.currentMetrics),
      this.renderProviderMetrics(data.currentMetrics),
      this.renderSatisfactionMetrics(data.currentMetrics),
      this.renderAlerts(data.alerts),
      this.renderSparkline(data.historicalMetrics),
      this.renderFooter(),
    ];

    return sections.join("\n");
  }

  /**
   * Render header
   */
  private renderHeader(): string {
    const title = " AI Response Telemetry Dashboard ";
    const padding = Math.floor((this.width - title.length) / 2);
    const line = "═".repeat(this.width);

    return [
      chalk.cyan(line),
      chalk.cyan("║") +
        " ".repeat(padding) +
        chalk.bold.white(title) +
        " ".repeat(this.width - padding - title.length - 1) +
        chalk.cyan("║"),
      chalk.cyan(line),
    ].join("\n");
  }

  /**
   * Render system status
   */
  private renderSystemStatus(data: DashboardData): string {
    const status = data.systemStatus;
    const healthIcon = status.healthy ? chalk.green("●") : chalk.red("●");
    const uptime = this.formatDuration(status.uptime);

    const activeProviders = Object.entries(status.providers)
      .filter(([_, p]) => p.available)
      .map(([name]) => name);

    return this.renderSection(
      "System Status",
      [
        `${healthIcon} Health: ${status.healthy ? chalk.green("Healthy") : chalk.red("Unhealthy")}`,
        `⏱️  Uptime: ${chalk.yellow(uptime)}`,
        `🔌 Active Providers: ${chalk.cyan(activeProviders.join(", ") || "None")}`,
        status.lastError ? `❌ Last Error: ${chalk.red(status.lastError)}` : "",
      ].filter(Boolean),
    );
  }

  /**
   * Render performance metrics
   */
  private renderPerformanceMetrics(metrics: AggregatedMetrics): string {
    const latencyColor =
      metrics.averageLatency < 500
        ? chalk.green
        : metrics.averageLatency < 1000
          ? chalk.yellow
          : chalk.red;

    return this.renderSection("Performance", [
      `📊 Total Responses: ${chalk.bold(metrics.totalResponses.toString())}`,
      `⚡ Average Latency: ${latencyColor(Math.round(metrics.averageLatency) + "ms")}`,
      `📈 P95 Latency: ${this.colorizeLatency(metrics.p95Latency)}`,
      `📈 P99 Latency: ${this.colorizeLatency(metrics.p99Latency)}`,
      this.renderBar(
        "Response Time Distribution",
        metrics.averageLatency,
        2000,
      ),
    ]);
  }

  /**
   * Render intent analytics
   */
  private renderIntentAnalytics(metrics: AggregatedMetrics): string {
    const intentLines = Object.entries(metrics.intentCounts)
      .map(([type, count]) => `  ${type}: ${chalk.yellow(count.toString())}`)
      .join(" | ");

    const langLines = Object.entries(metrics.languageDistribution)
      .map(
        ([lang, count]) => `  ${lang === "ja" ? "🇯🇵" : "🇬🇧"} ${lang}: ${count}`,
      )
      .join(" | ");

    return this.renderSection("Intent Analysis", [
      `🎯 Intent Types:`,
      intentLines || "  No data",
      `🌐 Languages:`,
      langLines || "  No data",
    ]);
  }

  /**
   * Render provider metrics
   */
  private renderProviderMetrics(metrics: AggregatedMetrics): string {
    const providerLines = Object.entries(metrics.providerDistribution).map(
      ([provider, count]) => {
        const percentage =
          metrics.totalResponses > 0
            ? Math.round((count / metrics.totalResponses) * 100)
            : 0;
        return `  ${provider}: ${count} (${percentage}%)`;
      },
    );

    const fallbackColor =
      metrics.fallbackRate > 0.3
        ? chalk.red
        : metrics.fallbackRate > 0.1
          ? chalk.yellow
          : chalk.green;

    return this.renderSection("Provider Usage", [
      ...providerLines,
      `🔄 Fallback Rate: ${fallbackColor((metrics.fallbackRate * 100).toFixed(1) + "%")}`,
      `❌ Error Rate: ${this.colorizeErrorRate(metrics.errorRate)}`,
      `🪙 Total Tokens: ${chalk.cyan(metrics.totalTokens.toLocaleString())}`,
      `📊 Avg Tokens/Request: ${Math.round(metrics.averageTokensPerRequest)}`,
    ]);
  }

  /**
   * Render satisfaction metrics
   */
  private renderSatisfactionMetrics(metrics: AggregatedMetrics): string {
    const satisfactionColor =
      metrics.satisfactionRate >= 0.8
        ? chalk.green
        : metrics.satisfactionRate >= 0.6
          ? chalk.yellow
          : chalk.red;

    const satisfactionBar = this.renderBar(
      "Satisfaction",
      metrics.satisfactionRate * 100,
      100,
      satisfactionColor,
    );

    const feedbackLines = Object.entries(metrics.feedbackDistribution).map(
      ([rating, count]) => {
        const emoji =
          rating === "positive" ? "👍" : rating === "negative" ? "👎" : "😐";
        return `  ${emoji} ${rating}: ${count}`;
      },
    );

    return this.renderSection("User Satisfaction", [
      `😊 Satisfaction Rate: ${satisfactionColor((metrics.satisfactionRate * 100).toFixed(1) + "%")}`,
      satisfactionBar,
      `📝 Total Feedback: ${metrics.feedbackCount}`,
      ...feedbackLines,
    ]);
  }

  /**
   * Render alerts
   */
  private renderAlerts(alerts: Alert[]): string {
    if (alerts.length === 0) {
      return this.renderSection("Alerts", [chalk.green("✓ No active alerts")]);
    }

    const alertLines = alerts.slice(0, 5).map((alert) => {
      const icon =
        alert.severity === "critical"
          ? "🔴"
          : alert.severity === "error"
            ? "🟠"
            : alert.severity === "warning"
              ? "🟡"
              : "ℹ️";
      const color =
        alert.severity === "critical"
          ? chalk.red
          : alert.severity === "error"
            ? chalk.yellow
            : alert.severity === "warning"
              ? chalk.yellow
              : chalk.blue;

      return `${icon} ${color(alert.message)}`;
    });

    if (alerts.length > 5) {
      alertLines.push(chalk.gray(`  ... and ${alerts.length - 5} more`));
    }

    return this.renderSection("Active Alerts", alertLines);
  }

  /**
   * Render sparkline chart
   */
  private renderSparkline(historicalMetrics: AggregatedMetrics[]): string {
    if (historicalMetrics.length < 2) {
      return "";
    }

    const latencies = historicalMetrics.map((m) => m.averageLatency);
    const sparkline = this.createSparkline(latencies);

    return this.renderSection("Latency Trend (Last 24h)", [
      sparkline,
      `Min: ${Math.round(Math.min(...latencies))}ms | Max: ${Math.round(Math.max(...latencies))}ms`,
    ]);
  }

  /**
   * Render footer
   */
  private renderFooter(): string {
    const _currentLine = "═".repeat(this.width);
    return [
      chalk.cyan(line),
      chalk.gray(
        `Last updated: ${new Date().toLocaleTimeString()} | Refresh: ${this.refreshInterval / 1000}s | Press Q to quit`,
      ),
    ].join("\n");
  }

  /**
   * Render a section with title and content
   */
  private renderSection(title: string, lines: string[]): string {
    return ["", chalk.bold.underline(title), ...lines].join("\n");
  }

  /**
   * Render a progress bar
   */
  private renderBar(
    _label: string,
    value: number,
    max: number,
    colorFn: typeof chalk = chalk,
  ): string {
    const percentage = Math.min(100, (value / max) * 100);
    const barWidth = 30;
    const filled = Math.round((percentage / 100) * barWidth);
    const empty = barWidth - filled;

    const bar = colorFn("█".repeat(filled)) + chalk.gray("░".repeat(empty));

    return `  ${bar} ${percentage.toFixed(1)}%`;
  }

  /**
   * Create sparkline from data
   */
  private createSparkline(data: number[]): string {
    const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    return data
      .map((value) => {
        const normalized = (value - min) / range;
        const index = Math.floor(normalized * (chars.length - 1));
        return chars[index];
      })
      .join("");
  }

  /**
   * Colorize latency value
   */
  private colorizeLatency(latency: number): string {
    const value = Math.round(latency) + "ms";
    if (latency < 500) return chalk.green(value);
    if (latency < 1000) return chalk.yellow(value);
    return chalk.red(value);
  }

  /**
   * Colorize error rate
   */
  private colorizeErrorRate(rate: number): string {
    const value = (rate * 100).toFixed(1) + "%";
    if (rate < 0.01) return chalk.green(value);
    if (rate < 0.05) return chalk.yellow(value);
    return chalk.red(value);
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
