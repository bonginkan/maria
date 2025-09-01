/**
 * GanttRenderer - Generate Mermaid Gantt charts and ICS calendars from SOWs
 * Converts SOW markdown content into visual project timelines
 */

import { GanttOutput, CalendarEvent } from "./types";
import { toICS, createCalendarEvent } from "../../utils/ics";

export class GanttRenderer {
  /**
   * Generate Gantt chart from SOW content
   */
  async fromSOW(sowContent: string): Promise<GanttOutput> {
    // Extract project information from SOW
    const projectInfo = this.extractProjectInfo(sowContent);

    // Extract WBS table if present
    const wbsItems = this.extractWBSTable(sowContent);

    // Generate Mermaid gantt
    const mermaid = this.generateMermaidGantt(projectInfo, wbsItems);

    // Generate calendar events
    const events = this.generateCalendarEvents(projectInfo, wbsItems);

    // Generate ICS content
    const ics = toICS(events);

    // Create metadata
    const metadata = {
      generatedAt: new Date(),
      totalTasks: wbsItems.length,
      duration: this.calculateProjectDuration(wbsItems),
      milestones: this.extractMilestones(sowContent),
    };

    return { mermaid, ics, metadata };
  }

  /**
   * Extract project information from SOW content
   */
  private extractProjectInfo(sowContent: string) {
    const titleMatch = sowContent.match(/^# (.+)$/m);
    const title = titleMatch
      ? titleMatch[1].replace("SOW: ", "").trim()
      : "Project";

    // Extract timeline information
    const startDateMatch = sowContent.match(/\*\*Start Date:\*\* (.+)$/m);
    const endDateMatch = sowContent.match(/\*\*Target End Date:\*\* (.+)$/m);

    const startDate = startDateMatch ? new Date(startDateMatch[1]) : new Date();
    const endDate = endDateMatch
      ? new Date(endDateMatch[1])
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return {
      title,
      startDate,
      endDate,
    };
  }

  /**
   * Extract WBS items from markdown table
   */
  private extractWBSTable(sowContent: string) {
    const wbsItems: any[] = [];

    // Look for WBS table
    const tableMatch = sowContent.match(
      /\| ID \| Task \| Estimated Hours[\s\S]*?(?=\n\n|\n#|\n\*\*|$)/,
    );

    if (tableMatch) {
      const tableContent = tableMatch[0];
      const rows = tableContent.split("\n").slice(2); // Skip header and separator

      rows.forEach((row, index) => {
        const cells = row
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell);

        if (cells.length >= 4) {
          wbsItems.push({
            id: cells[0],
            title: cells[1],
            estimatedHours: parseInt(cells[2]) || 8,
            priority: cells[3] || "medium",
            status: cells[4] || "pending",
            assignee: cells[5] || "TBD",
          });
        }
      });
    }

    // If no WBS table found, generate default items from content
    if (wbsItems.length === 0) {
      wbsItems.push(
        {
          id: "planning",
          title: "Planning & Design",
          estimatedHours: 16,
          priority: "high",
          status: "pending",
        },
        {
          id: "implementation",
          title: "Core Implementation",
          estimatedHours: 32,
          priority: "critical",
          status: "pending",
        },
        {
          id: "testing",
          title: "Testing & QA",
          estimatedHours: 16,
          priority: "high",
          status: "pending",
        },
        {
          id: "deployment",
          title: "Deployment",
          estimatedHours: 8,
          priority: "medium",
          status: "pending",
        },
      );
    }

    return wbsItems;
  }

  /**
   * Generate Mermaid gantt chart
   */
  private generateMermaidGantt(projectInfo: any, wbsItems: any[]): string {
    const lines = [
      "gantt",
      `    title ${projectInfo.title}`,
      `    dateFormat YYYY-MM-DD`,
      `    axisFormat %m/%d`,
      "",
    ];

    // Group tasks by section/category
    const sections = this.groupTasksBySection(wbsItems);

    let currentDate = new Date(projectInfo.startDate);

    Object.entries(sections).forEach(([sectionName, tasks]) => {
      lines.push(`    section ${sectionName}`);

      (tasks as any[]).forEach((task, index) => {
        const durationDays = Math.ceil(task.estimatedHours / 8) || 1;
        const endDate = new Date(
          currentDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
        );

        const status = this.mapStatusToMermaid(task.status);
        const taskLine = `    ${task.title.slice(0, 20).padEnd(20)} :${status}, ${task.id}, ${this.formatMermaidDate(currentDate)}, ${durationDays}d`;

        lines.push(taskLine);

        // Update current date for next task (simple sequential scheduling)
        currentDate = new Date(endDate);
      });

      lines.push("");
    });

    return lines.join("\n");
  }

  /**
   * Group tasks into logical sections
   */
  private groupTasksBySection(wbsItems: any[]) {
    const sections: { [key: string]: any[] } = {};

    wbsItems.forEach((item) => {
      let sectionName = "Implementation";

      // Categorize based on task title/id
      if (
        item.title.toLowerCase().includes("plan") ||
        item.id.includes("planning")
      ) {
        sectionName = "Planning";
      } else if (
        item.title.toLowerCase().includes("test") ||
        item.title.toLowerCase().includes("qa")
      ) {
        sectionName = "Testing";
      } else if (
        item.title.toLowerCase().includes("deploy") ||
        item.title.toLowerCase().includes("release")
      ) {
        sectionName = "Deployment";
      } else if (
        item.title.toLowerCase().includes("design") ||
        item.title.toLowerCase().includes("architecture")
      ) {
        sectionName = "Design";
      }

      if (!sections[sectionName]) {
        sections[sectionName] = [];
      }

      sections[sectionName].push(item);
    });

    return sections;
  }

  /**
   * Map status to Mermaid format
   */
  private mapStatusToMermaid(status: string): string {
    switch (status.toLowerCase()) {
      case "completed":
        return "done";
      case "in_progress":
      case "in progress":
        return "active";
      case "blocked":
        return "crit";
      default:
        return "";
    }
  }

  /**
   * Format date for Mermaid
   */
  private formatMermaidDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Generate calendar events for ICS export
   */
  private generateCalendarEvents(
    projectInfo: any,
    wbsItems: any[],
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    let currentDate = new Date(projectInfo.startDate);

    wbsItems.forEach((item) => {
      const durationDays = Math.ceil(item.estimatedHours / 8) || 1;

      const event = createCalendarEvent(
        item.title,
        currentDate,
        durationDays,
        `${item.title}\nEstimated: ${item.estimatedHours}h\nPriority: ${item.priority}\nAssignee: ${item.assignee || "TBD"}`,
        "Project Workspace",
      );

      events.push(event);

      // Update current date for next task
      currentDate = new Date(
        currentDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
      );
    });

    // Add project milestone events
    const milestones = this.extractMilestones(projectInfo.title);
    milestones.forEach((milestone, index) => {
      const milestoneDate = new Date(
        projectInfo.startDate.getTime() +
          ((index + 1) *
            (projectInfo.endDate.getTime() - projectInfo.startDate.getTime())) /
            (milestones.length + 1),
      );

      events.push(
        createCalendarEvent(
          `🎯 Milestone: ${milestone}`,
          milestoneDate,
          1,
          `Project milestone checkpoint`,
          "Project Workspace",
        ),
      );
    });

    return events;
  }

  /**
   * Calculate total project duration
   */
  private calculateProjectDuration(wbsItems: any[]): string {
    const totalHours = wbsItems.reduce(
      (sum, item) => sum + (item.estimatedHours || 0),
      0,
    );
    const totalDays = Math.ceil(totalHours / 8);
    const weeks = Math.floor(totalDays / 5);
    const remainingDays = totalDays % 5;

    if (weeks > 0) {
      return remainingDays > 0 ? `${weeks}w ${remainingDays}d` : `${weeks}w`;
    }

    return `${totalDays}d`;
  }

  /**
   * Extract milestones from SOW content
   */
  private extractMilestones(sowContent: string): string[] {
    const milestones: string[] = [];

    // Look for milestone patterns
    const milestoneMatches = sowContent.matchAll(
      /\*\*Milestone \d+: (.+?)\*\*/g,
    );

    for (const match of milestoneMatches) {
      milestones.push(match[1]);
    }

    // Default milestones if none found
    if (milestones.length === 0) {
      milestones.push(
        "Planning Complete",
        "Implementation Complete",
        "Testing Complete",
        "Project Delivery",
      );
    }

    return milestones;
  }
}
