/**
 * MARIA v3.6.0 - Real-time Monitoring Dashboard UI
 * Enterprise-grade monitoring with <100ms updates
 * WebSocket-based real-time data streaming
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// Type definitions
interface MetricData {
  timestamp: number;
  value: number;
  label?: string;
  category?: string;
}

interface AlertData {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: number;
  source: string;
  acknowledged: boolean;
}

interface SystemStatus {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  uptime: number;
  errors: number;
}

interface WebSocketMessage {
  type: "metrics" | "alerts" | "status" | "heartbeat";
  data: any;
  timestamp: number;
}

// Color constants for charts
const CHART_COLORS = {
  primary: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#6366F1",
  neutral: "#6B7280",
};

const STATUS_COLORS = ["#10B981", "#F59E0B", "#EF4444", "#6366F1"];

// Performance-optimized metric display component
const MetricCard: React.FC<{
  title: string;
  value: number;
  unit: string;
  trend?: number;
  status: "good" | "warning" | "critical";
}> = React.memo(({ title, value, unit, trend, status }) => {
  const statusColor = {
    good: "text-green-600 bg-green-50",
    warning: "text-yellow-600 bg-yellow-50",
    critical: "text-red-600 bg-red-50",
  }[status];

  const TrendIcon = trend && trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend && trend > 0 ? "text-green-500" : "text-red-500";

  return (
    <div className={`p-4 rounded-lg border ${statusColor}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold">
            {value.toLocaleString()} {unit}
          </p>
        </div>
        {trend && (
          <div className={`flex items-center ${trendColor}`}>
            <TrendIcon size={16} />
            <span className="ml-1 text-sm">{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
});

// Real-time chart component with performance optimization
const RealTimeChart: React.FC<{
  data: MetricData[];
  title: string;
  color?: string;
  type?: "line" | "area" | "bar";
}> = React.memo(
  ({ data, title, color = CHART_COLORS.primary, type = "line" }) => {
    // Keep only last 100 data points for performance
    const chartData = useMemo(
      () =>
        data.slice(-100).map((d) => ({
          ...d,
          time: new Date(d.timestamp).toLocaleTimeString(),
        })),
      [data],
    );

    const ChartComponent = {
      line: LineChart,
      area: AreaChart,
      bar: BarChart,
    }[type];

    const DataComponent = {
      line: Line,
      area: Area,
      bar: Bar,
    }[type];

    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ChartComponent data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            {type === "area" ? (
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={color}
                fillOpacity={0.3}
              />
            ) : type === "line" ? (
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            ) : (
              <Bar dataKey="value" fill={color} />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    );
  },
);

// Alert panel component
const AlertPanel: React.FC<{ alerts: AlertData[] }> = React.memo(
  ({ alerts }) => {
    const [filter, setFilter] = useState<
      "all" | "critical" | "warning" | "info"
    >("all");

    const filteredAlerts = useMemo(
      () =>
        alerts
          .filter((alert) => filter === "all" || alert.severity === filter)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50), // Limit to 50 for performance
      [alerts, filter],
    );

    const getAlertIcon = (severity: string) => {
      switch (severity) {
        case "critical":
          return <XCircle className="text-red-500" size={20} />;
        case "warning":
          return <AlertTriangle className="text-yellow-500" size={20} />;
        default:
          return <CheckCircle className="text-blue-500" size={20} />;
      }
    };

    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Active Alerts</h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1 border rounded"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center p-3 border-b last:border-b-0"
            >
              {getAlertIcon(alert.severity)}
              <div className="ml-3 flex-1">
                <p className="font-medium">{alert.message}</p>
                <p className="text-sm text-gray-500">
                  {alert.source} • {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
              {!alert.acknowledged && (
                <button className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
                  Acknowledge
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },
);

// System status overview component
const SystemOverview: React.FC<{ status: SystemStatus }> = React.memo(
  ({ status }) => {
    const metrics = [
      { name: "CPU", value: status.cpu, max: 100, color: CHART_COLORS.primary },
      {
        name: "Memory",
        value: status.memory,
        max: 100,
        color: CHART_COLORS.warning,
      },
      {
        name: "Disk",
        value: status.disk,
        max: 100,
        color: CHART_COLORS.success,
      },
      {
        name: "Network",
        value: status.network,
        max: 100,
        color: CHART_COLORS.info,
      },
    ];

    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">System Overview</h3>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.name} className="flex items-center">
              <div className="w-20 text-sm font-medium">{metric.name}</div>
              <div className="flex-1 mx-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${metric.value}%`,
                      backgroundColor: metric.color,
                    }}
                  />
                </div>
              </div>
              <div className="w-16 text-sm text-right">
                {metric.value.toFixed(1)}%
              </div>
            </div>
          ))}

          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>
                Uptime: {Math.floor(status.uptime / 3600)}h{" "}
                {Math.floor((status.uptime % 3600) / 60)}m
              </span>
              <span
                className={
                  status.errors > 0 ? "text-red-500" : "text-green-500"
                }
              >
                Errors: {status.errors}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

// Main monitoring dashboard component
export const MonitoringDashboardUI: React.FC = () => {
  // State management
  const [metrics, setMetrics] = useState<Record<string, MetricData[]>>({
    cpu: [],
    memory: [],
    requests: [],
    errors: [],
  });

  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0,
    uptime: 0,
    errors: 0,
  });

  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "disconnected"
  >("disconnected");
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // WebSocket connection management
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      setConnectionStatus("connecting");
      ws = new WebSocket(`ws://localhost:3001/monitoring`);

      ws.onopen = () => {
        setConnectionStatus("connected");
        console.log("🔗 WebSocket connected to monitoring dashboard");
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastUpdate(Date.now());

          switch (message.type) {
            case "metrics":
              setMetrics((prev) => {
                const newMetrics = { ...prev };
                Object.entries(message.data).forEach(([key, data]) => {
                  if (!newMetrics[key]) newMetrics[key] = [];
                  newMetrics[key] = [
                    ...newMetrics[key].slice(-99),
                    data as MetricData,
                  ];
                });
                return newMetrics;
              });
              break;

            case "alerts":
              setAlerts((prev) => {
                const newAlerts = Array.isArray(message.data)
                  ? message.data
                  : [message.data];
                return [...newAlerts, ...prev].slice(0, 100); // Keep last 100 alerts
              });
              break;

            case "status":
              setSystemStatus(message.data);
              break;

            case "heartbeat":
              // Keep connection alive
              break;
          }
        } catch (error) {
          console.error("❌ WebSocket message parsing error:", error);
        }
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
        console.log("🔌 WebSocket disconnected, attempting reconnect...");

        // Exponential backoff reconnection
        reconnectTimeout = setTimeout(
          connect,
          Math.min(5000, 1000 * Math.pow(2, 1)),
        );
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        setConnectionStatus("disconnected");
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Performance metrics calculation
  const performanceMetrics = useMemo(() => {
    const now = Date.now();
    const cpuTrend =
      metrics.cpu.length > 1
        ? (metrics.cpu[metrics.cpu.length - 1]?.value || 0) -
          (metrics.cpu[metrics.cpu.length - 10]?.value || 0)
        : 0;

    return {
      cpuTrend,
      avgResponseTime:
        metrics.requests.slice(-10).reduce((sum, m) => sum + m.value, 0) / 10 ||
        0,
      errorRate:
        metrics.errors.slice(-10).reduce((sum, m) => sum + m.value, 0) / 10 ||
        0,
      lastUpdateLatency: now - lastUpdate,
    };
  }, [metrics, lastUpdate]);

  // Connection status indicator
  const connectionIndicator = (
    <div
      className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
        connectionStatus === "connected"
          ? "bg-green-100 text-green-800"
          : connectionStatus === "connecting"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-red-100 text-red-800"
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          connectionStatus === "connected"
            ? "bg-green-500"
            : connectionStatus === "connecting"
              ? "bg-yellow-500"
              : "bg-red-500"
        }`}
      />
      <span>{connectionStatus.toUpperCase()}</span>
      {connectionStatus === "connected" && (
        <span className="text-xs">
          ({performanceMetrics.lastUpdateLatency}ms)
        </span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            MARIA v3.6.0 Monitoring
          </h1>
          <p className="text-gray-600">
            Enterprise Real-time Performance Dashboard
          </p>
        </div>
        {connectionIndicator}
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard
          title="CPU Usage"
          value={systemStatus.cpu}
          unit="%"
          trend={performanceMetrics.cpuTrend}
          status={
            systemStatus.cpu > 80
              ? "critical"
              : systemStatus.cpu > 60
                ? "warning"
                : "good"
          }
        />
        <MetricCard
          title="Memory Usage"
          value={systemStatus.memory}
          unit="%"
          status={
            systemStatus.memory > 85
              ? "critical"
              : systemStatus.memory > 70
                ? "warning"
                : "good"
          }
        />
        <MetricCard
          title="Avg Response Time"
          value={performanceMetrics.avgResponseTime}
          unit="ms"
          status={
            performanceMetrics.avgResponseTime > 1000
              ? "critical"
              : performanceMetrics.avgResponseTime > 500
                ? "warning"
                : "good"
          }
        />
        <MetricCard
          title="Error Rate"
          value={performanceMetrics.errorRate}
          unit="/min"
          status={
            performanceMetrics.errorRate > 5
              ? "critical"
              : performanceMetrics.errorRate > 1
                ? "warning"
                : "good"
          }
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <RealTimeChart
          data={metrics.cpu}
          title="CPU Usage Over Time"
          color={CHART_COLORS.primary}
          type="area"
        />
        <RealTimeChart
          data={metrics.memory}
          title="Memory Usage Over Time"
          color={CHART_COLORS.warning}
          type="line"
        />
        <RealTimeChart
          data={metrics.requests}
          title="Request Response Times"
          color={CHART_COLORS.success}
          type="line"
        />
        <RealTimeChart
          data={metrics.errors}
          title="Error Rate"
          color={CHART_COLORS.danger}
          type="bar"
        />
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Overview - spans 1 column */}
        <SystemOverview status={systemStatus} />

        {/* Alert Panel - spans 2 columns */}
        <div className="lg:col-span-2">
          <AlertPanel alerts={alerts} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Last updated: {new Date(lastUpdate).toLocaleString()} | Update latency:{" "}
        {performanceMetrics.lastUpdateLatency}ms | Active connections:{" "}
        {connectionStatus === "connected" ? "1" : "0"}
      </div>
    </div>
  );
};

export default MonitoringDashboardUI;
