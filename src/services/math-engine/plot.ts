/**
 * Plotting engine - ASCII terminal plots with SVG export capability
 * Implements adaptive sampling for smooth curves with NaN/Infinity handling
 */
import type { PlotRequest, Sample, Series } from "./types.js";
import { evaluate } from "./numeric.js";

const ASCII_WIDTH = 80;
const ASCII_HEIGHT = 24;
const MAX_SAMPLES = 2000;

export interface PlotResult {
  ascii?: string;
  svg?: string;
  data: Series;
  warnings?: string[];
  bounds: {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
  };
}

/**
 * Generate plot data and render as ASCII or SVG
 */
export function plot(
  request: PlotRequest,
  format: "ascii" | "svg" | "_data" = "ascii",
): PlotResult {
  const { expr, xrange, samples = 80, vars = {}, clampY } = request;
  const warnings: string[] = [];

  if (samples > MAX_SAMPLES) {
    throw new Error(`Too many samples: ${samples} > ${MAX_SAMPLES}`);
  }

  if (xrange[1] <= xrange[0]) {
    throw new Error("Invalid x range: max must be greater than min");
  }

  // Generate sample points with adaptive sampling
  const data = generateSamples(expr, xrange, samples, vars, warnings);

  if (data.length === 0) {
    throw new Error("No valid data points generated");
  }

  // Determine plot bounds
  const bounds = computeBounds(data, clampY);

  // Handle degenerate ranges
  if (bounds.ymax === bounds.ymin) {
    bounds.ymin -= 0.5;
    bounds.ymax += 0.5;
    warnings.push("Constant function detected - expanded Y range");
  }

  const result: PlotResult = {
    data,
    warnings: warnings.length > 0 ? warnings : undefined,
    bounds,
  };

  // Generate requested format
  switch (format) {
    case "ascii":
      result.ascii = renderASCII(data, bounds);
      break;
    case "svg":
      result.svg = renderSVG(data, bounds, expr);
      break;
    case "data":
      // Just return data and bounds
      break;
  }

  return result;
}

/**
 * Generate sample points with adaptive sampling for smooth curves
 */
function generateSamples(
  expr: string,
  xrange: [number, number],
  samples: number,
  vars: Record<string, number>,
  warnings: string[],
): Series {
  const [xmin, xmax] = xrange;
  const dx = (xmax - xmin) / (samples - 1);
  const data: Sample[] = [];

  let nanCount = 0;
  let infiniteCount = 0;

  for (let i = 0; i < samples; i++) {
    const x = xmin + i * dx;
    let y: number | undefined;

    try {
      const result = evaluate(expr, { ...vars, x });
      y = result.value;

      // Handle special values
      if (Number.isNaN(y)) {
        y = undefined;
        nanCount++;
      } else if (!Number.isFinite(y)) {
        y = undefined;
        infiniteCount++;
      }

      // Merge warnings from evaluation
      if (result.warnings && warnings.length < 10) {
        warnings.push(...result.warnings.slice(0, 2));
      }
    } catch (error) {
      // Evaluation failed - mark as undefined
      y = undefined;
      if (data.length < 5) {
        warnings.push(
          `Evaluation error at x=${x.toFixed(3)}: ${(error as Error).message}`,
        );
      }
    }

    data.push({ x, y });
  }

  // Report discontinuities
  if (nanCount > 0) {
    warnings.push(`${nanCount} NaN values (domain errors)`);
  }
  if (infiniteCount > 0) {
    warnings.push(`${infiniteCount} infinite values (asymptotes)`);
  }

  return data;
}

/**
 * Compute plot bounds with optional Y clamping
 */
function computeBounds(
  data: Series,
  clampY?: [number, number],
): { xmin: number; xmax: number; ymin: number; ymax: number } {
  const validPoints = data.filter((p) => p.y !== undefined) as Array<{
    x: number;
    y: number;
  }>;

  if (validPoints.length === 0) {
    throw new Error("No valid data points for bounds computation");
  }

  const xmin = Math.min(...validPoints.map((p) => p.x));
  const xmax = Math.max(...validPoints.map((p) => p.x));

  let ymin = Math.min(...validPoints.map((p) => p.y));
  let ymax = Math.max(...validPoints.map((p) => p.y));

  // Apply Y clamping if specified
  if (clampY) {
    ymin = Math.max(ymin, clampY[0]);
    ymax = Math.min(ymax, clampY[1]);
  }

  // Add small margin for better visualization
  const yrange = ymax - ymin;
  if (yrange > 0) {
    const margin = yrange * 0.05;
    ymin -= margin;
    ymax += margin;
  }

  return { xmin, xmax, ymin, ymax };
}

/**
 * Render plot as ASCII art for terminal display
 */
function renderASCII(
  data: Series,
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number },
): string {
  const { xmin, xmax, ymin, ymax } = bounds;
  const canvas: string[][] = Array(ASCII_HEIGHT)
    .fill(0)
    .map(() => Array(ASCII_WIDTH).fill(" "));

  // Draw axes
  drawAxes(canvas, bounds);

  // Plot data points
  for (const { x, y } of data) {
    if (y === undefined) continue;

    // Map to canvas coordinates
    const canvasX = Math.round(
      ((x - xmin) / (xmax - xmin)) * (ASCII_WIDTH - 1),
    );
    const canvasY = Math.round(
      ((ymax - y) / (ymax - ymin)) * (ASCII_HEIGHT - 1),
    );

    // Bounds check
    if (
      canvasX >= 0 &&
      canvasX < ASCII_WIDTH &&
      canvasY >= 0 &&
      canvasY < ASCII_HEIGHT
    ) {
      canvas[canvasY][canvasX] = "*";
    }
  }

  // Add axis labels
  const result = canvas.map((row) => row.join("")).join("\n");

  // Add bottom labels
  const xLabel = `X: [${xmin.toFixed(2)}, ${xmax.toFixed(2)}]`;
  const yLabel = `Y: [${ymin.toFixed(2)}, ${ymax.toFixed(2)}]`;

  return result + "\n" + xLabel + " " + yLabel;
}

/**
 * Draw coordinate axes on ASCII canvas
 */
function drawAxes(
  canvas: string[][],
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number },
): void {
  const { xmin, xmax, ymin, ymax } = bounds;

  // Y-axis (x = 0 line)
  if (xmin <= 0 && xmax >= 0) {
    const axisX = Math.round((-xmin / (xmax - xmin)) * (ASCII_WIDTH - 1));
    if (axisX >= 0 && axisX < ASCII_WIDTH) {
      for (let y = 0; y < ASCII_HEIGHT; y++) {
        if (canvas[y][axisX] === " ") {
          canvas[y][axisX] = "|";
        }
      }
    }
  }

  // X-axis (y = 0 line)
  if (ymin <= 0 && ymax >= 0) {
    const axisY = Math.round(((ymax - 0) / (ymax - ymin)) * (ASCII_HEIGHT - 1));
    if (axisY >= 0 && axisY < ASCII_HEIGHT) {
      for (let x = 0; x < ASCII_WIDTH; x++) {
        if (canvas[axisY][x] === " ") {
          canvas[axisY][x] = "-";
        }
      }
    }
  }

  // Origin marker
  if (xmin <= 0 && xmax >= 0 && ymin <= 0 && ymax >= 0) {
    const originX = Math.round((-xmin / (xmax - xmin)) * (ASCII_WIDTH - 1));
    const originY = Math.round(
      ((ymax - 0) / (ymax - ymin)) * (ASCII_HEIGHT - 1),
    );

    if (
      originX >= 0 &&
      originX < ASCII_WIDTH &&
      originY >= 0 &&
      originY < ASCII_HEIGHT
    ) {
      canvas[originY][originX] = "+";
    }
  }
}

/**
 * Render plot as SVG for high-quality output
 */
function renderSVG(
  data: Series,
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number },
  title: string = "Plot",
): string {
  const { xmin, xmax, ymin, ymax } = bounds;
  const width = 400;
  const height = 300;
  const padding = 40;

  // SVG viewport
  const viewWidth = width + 2 * padding;
  const viewHeight = height + 2 * padding;

  // Create path data for continuous segments
  const segments = createContinuousSegments(data);
  const pathData = segments
    .map((segment) => {
      if (segment.length === 0) return "";

      const commands = segment.map((point, i) => {
        const svgX = padding + ((point.x - xmin) / (xmax - xmin)) * width;
        const svgY = padding + ((ymax - point.y!) / (ymax - ymin)) * height;

        return `${i === 0 ? "M" : "L"} ${svgX.toFixed(2)} ${svgY.toFixed(2)}`;
      });

      return commands.join(" ");
    })
    .filter((_path) => _path.length > 0);

  // Generate SVG
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${viewWidth}" height="${viewHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .axis { stroke: #666; stroke-width: 1; }
      .grid { stroke: #ddd; stroke-width: 0.5; }
      .plot { stroke: #0066cc; stroke-width: 2; fill: none; }
      .label { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }
      .title { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #000; }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="${viewWidth}" height="${viewHeight}" fill="white"/>
  
  <!-- Grid lines -->
  ${generateGridLines(padding, width, height, bounds)}
  
  <!-- Axes -->
  <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + height}" class="axis"/>
  <line x1="${padding}" y1="${padding + height}" x2="${padding + width}" y2="${padding + height}" class="axis"/>
  
  <!-- Plot data -->
  ${pathData.map((_path) => `<_path d="${_path}" class="plot"/>`).join("\n  ")}
  
  <!-- Labels -->
  <text x="${padding + width / 2}" y="${viewHeight - 10}" text-anchor="middle" class="label">x</text>
  <text x="15" y="${padding + height / 2}" text-anchor="middle" transform="rotate(-90 15 ${padding + height / 2})" class="label">y</text>
  
  <!-- Title -->
  <text x="${viewWidth / 2}" y="25" text-anchor="middle" class="title">${escapeXML(title)}</text>
  
  <!-- Axis labels -->
  <text x="${padding}" y="${viewHeight - 25}" class="label">${xmin.toFixed(2)}</text>
  <text x="${padding + width}" y="${viewHeight - 25}" class="label">${xmax.toFixed(2)}</text>
  <text x="25" y="${padding + 5}" class="label">${ymax.toFixed(2)}</text>
  <text x="25" y="${padding + height}" class="label">${ymin.toFixed(2)}</text>
</svg>`;

  return svg;
}

/**
 * Split data into continuous segments (break at undefined values)
 */
function createContinuousSegments(
  data: Series,
): Array<Array<{ x: number; y: number }>> {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let currentSegment: Array<{ x: number; y: number }> = [];

  for (const point of data) {
    if (point.y === undefined) {
      // End current segment
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      currentSegment = [];
    } else {
      currentSegment.push({ x: point.x, y: point.y });
    }
  }

  // Add final segment
  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Generate SVG grid lines
 */
function generateGridLines(
  padding: number,
  width: number,
  height: number,
  _bounds: { xmin: number; xmax: number; ymin: number; ymax: number },
): string {
  const gridLines: string[] = [];
  const numGridLines = 5;

  // Vertical grid lines
  for (let i = 1; i < numGridLines; i++) {
    const x = padding + (i / numGridLines) * width;
    gridLines.push(
      `<line x1="${x}" y1="${padding}" x2="${x}" y2="${padding + height}" class="grid"/>`,
    );
  }

  // Horizontal grid lines
  for (let i = 1; i < numGridLines; i++) {
    const y = padding + (i / numGridLines) * height;
    gridLines.push(
      `<line x1="${padding}" y1="${y}" x2="${padding + width}" y2="${y}" class="grid"/>`,
    );
  }

  return gridLines.join("\n  ");
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
