/**
 * ICS Calendar Utility - Generate iCalendar (.ics) files
 * Used by PM planner for calendar export functionality
 */

import { CalendarEvent } from "../services/pm-planner/types";

/**
 * Generate ICS content from calendar events
 */
export function toICS(events: CalendarEvent[]): string {
  const now = new Date();
  const timestamp = formatICSDate(now);

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MARIA PM Suite//Project Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  events.forEach((event, index) => {
    icsLines.push(...generateEventLines(event, index, timestamp));
  });

  icsLines.push("END:VCALENDAR");

  return icsLines.join("\r\n");
}

/**
 * Generate ICS lines for a single event
 */
function generateEventLines(
  event: CalendarEvent,
  index: number,
  timestamp: string,
): string[] {
  const startDate = new Date(event.start);
  const endDate = new Date(
    startDate.getTime() + event.durationDays * 24 * 60 * 60 * 1000,
  );

  const uid = `maria-pm-${Date.now()}-${index}@maria.ai`;

  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${timestamp}`,
    `DTSTART;VALUE=DATE:${formatICSDateOnly(startDate)}`,
    `DTEND;VALUE=DATE:${formatICSDateOnly(endDate)}`,
    `SUMMARY:${escapeICSText(event.summary)}`,
    `STATUS:TENTATIVE`,
    `TRANSP:OPAQUE`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICSText(event.location)}`);
  }

  // Add categories for project management
  lines.push(`CATEGORIES:Project,MARIA,Planning`);

  lines.push("END:VEVENT");

  return lines;
}

/**
 * Format date for ICS timestamp (YYYYMMDDTHHMMSSZ)
 */
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Format date for ICS date-only format (YYYYMMDD)
 */
function formatICSDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

/**
 * Escape text for ICS format (handle special characters, line breaks, etc.)
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/;/g, "\\;") // Escape semicolons
    .replace(/,/g, "\\,") // Escape commas
    .replace(/\n/g, "\\n") // Escape newlines
    .replace(/\r/g, "") // Remove carriage returns
    .trim();
}

/**
 * Create a calendar event from basic parameters
 */
export function createCalendarEvent(
  summary: string,
  start: string | Date,
  durationDays: number,
  description?: string,
  location?: string,
): CalendarEvent {
  const startDate =
    typeof start === "string" ? start : start.toISOString().split("T")[0];

  return {
    summary,
    start: startDate,
    durationDays,
    description,
    location,
  };
}

/**
 * Validate ICS content (basic validation)
 */
export function validateICS(icsContent: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!icsContent.includes("BEGIN:VCALENDAR")) {
    errors.push("Missing BEGIN:VCALENDAR");
  }

  if (!icsContent.includes("END:VCALENDAR")) {
    errors.push("Missing END:VCALENDAR");
  }

  if (!icsContent.includes("VERSION:2.0")) {
    errors.push("Missing VERSION:2.0");
  }

  // Check for balanced BEGIN/END pairs
  const beginMatches = icsContent.match(/BEGIN:/g);
  const endMatches = icsContent.match(/END:/g);

  if (
    !beginMatches ||
    !endMatches ||
    beginMatches.length !== endMatches.length
  ) {
    errors.push("Unbalanced BEGIN/END pairs");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
