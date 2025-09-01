/**
 * SOWGenerator - PM-specific Statement of Work generation
 * Generates structured SOWs from natural language prompts and analysis data
 * Distinct from active-reporting/SOWGenerator - focused on PM workflow
 */

import { AnalysisReport, SOWContent, SOWMetadata, WBSItem } from "./types";

export class SOWGenerator {
  /**
   * Generate SOW from natural language prompt and analysis basis
   */
  async generate(prompt: string, basis: AnalysisReport): Promise<SOWContent> {
    const metadata: SOWMetadata = {
      title: this.generateTitle(prompt),
      prompt,
      basisSummary: basis.basis.slice(0, 5),
      generatedAt: new Date(),
      version: "1.0.0",
    };

    const content = this.generateSOWMarkdown(prompt, basis, metadata);

    return { content, meta: metadata };
  }

  /**
   * Generate title from prompt
   */
  private generateTitle(prompt: string): string {
    // Extract key phrases for title
    const words = prompt.split(" ").slice(0, 8);
    let title = words.join(" ");

    // Add "SOW" prefix if not present
    if (!title.toLowerCase().includes("sow")) {
      title = `SOW: ${title}`;
    }

    return title;
  }

  /**
   * Generate complete SOW markdown content
   */
  private generateSOWMarkdown(
    prompt: string,
    basis: AnalysisReport,
    metadata: SOWMetadata,
  ): string {
    const md = `# ${metadata.title}

**Generated on:** ${metadata.generatedAt.toLocaleDateString()}  
**Version:** ${metadata.version}

## 🎯 Objective

${this.generateObjective(prompt, basis)}

## 📋 Scope

### In Scope
${this.generateInScopeItems(prompt, basis)}

### Out of Scope
- Any work not explicitly mentioned in this SOW
- Future enhancements beyond current requirements
- Third-party integrations not specified

## 🚀 Deliverables

${this.generateDeliverables(basis)}

## ⏰ Timeline & Milestones

${this.generateTimeline(basis)}

## 👥 Team & Responsibilities

${this.generateTeamSection(basis)}

## 📊 Success Criteria

${this.generateSuccessCriteria(prompt, basis)}

## ⚠️ Risks & Mitigation

${this.generateRisksSection(basis)}

## 📋 Work Breakdown Structure (WBS)

${this.generateWBSSection(basis)}

## 🏛️ Governance & Approval

**Approval Required From:**
- Project Manager (PM)
- Product Owner (PO) 
- Technical Lead (TL)

**Review Frequency:** Weekly status updates
**Change Management:** All scope changes require formal approval

## 📚 Basis & References

This SOW was generated based on:
${basis.basis.map((item) => `- ${item}`).join("\n")}

**Analysis Summary:**
- Total Estimated Hours: ${basis.analysis.totalEstimatedHours}
- Complexity Level: ${basis.analysis.complexity}
- Risk Level: ${basis.analysis.riskLevel}
- Data Sources: ${basis.sources.join(", ")}

---

*🤖 Generated with [MARIA PM Suite](https://github.com/bonginkim/maria) v${metadata.version}*

*Co-Authored-By: MARIA <noreply@maria.ai>*
`;

    return md;
  }

  /**
   * Generate objective section
   */
  private generateObjective(prompt: string, basis: AnalysisReport): string {
    let objective = prompt;

    // Enhance with context from basis
    if (
      basis.analysis.complexity === "complex" ||
      basis.analysis.complexity === "very_complex"
    ) {
      objective +=
        "\n\nThis is a complex initiative requiring careful coordination and risk management.";
    }

    if (basis.analysis.riskLevel === "high") {
      objective +=
        " Special attention will be paid to risk mitigation throughout the project.";
    }

    return objective;
  }

  /**
   * Generate in-scope items
   */
  private generateInScopeItems(prompt: string, basis: AnalysisReport): string {
    const items = [];

    // Extract scope from WBS items
    basis.wbs.slice(0, 5).forEach((item) => {
      items.push(`- ${item.title}`);
    });

    // Add items based on prompt keywords
    if (
      prompt.toLowerCase().includes("performance") ||
      prompt.toLowerCase().includes("latency")
    ) {
      items.push("- Performance optimization and monitoring");
    }

    if (
      prompt.toLowerCase().includes("gpu") ||
      prompt.toLowerCase().includes("acceleration")
    ) {
      items.push("- GPU acceleration implementation");
    }

    if (
      prompt.toLowerCase().includes("search") ||
      prompt.toLowerCase().includes("rerank")
    ) {
      items.push("- Search and reranking improvements");
    }

    return (
      items.join("\n") || "- Core implementation as specified in objective"
    );
  }

  /**
   * Generate deliverables section
   */
  private generateDeliverables(basis: AnalysisReport): string {
    const deliverables = [
      "1. **Production-Ready Code**",
      "   - Fully tested and documented source code",
      "   - Code review approval from technical leads",
      "   - Performance benchmarks meeting requirements",
      "",
      "2. **Technical Documentation**",
      "   - Architecture design documents",
      "   - API documentation (if applicable)",
      "   - Deployment and operations guide",
      "",
      "3. **Testing Artifacts**",
      "   - Comprehensive test suite (unit, integration, performance)",
      "   - Test coverage reports (>80% target)",
      "   - Quality assurance sign-off",
    ];

    // Add specific deliverables based on WBS
    if (basis.wbs.some((item) => item.title.toLowerCase().includes("gpu"))) {
      deliverables.push(
        "",
        "4. **GPU Optimization Components**",
        "   - GPU-accelerated processing modules",
        "   - Performance comparison benchmarks",
      );
    }

    if (basis.wbs.some((item) => item.title.toLowerCase().includes("search"))) {
      deliverables.push(
        "",
        "5. **Search Enhancement Package**",
        "   - Enhanced search algorithms",
        "   - Relevance metrics and evaluation",
      );
    }

    return deliverables.join("\n");
  }

  /**
   * Generate timeline section
   */
  private generateTimeline(basis: AnalysisReport): string {
    const totalHours = basis.analysis.totalEstimatedHours;
    const totalDays = Math.ceil(totalHours / 8); // 8 hours per day
    const totalWeeks = Math.ceil(totalDays / 5); // 5 working days per week

    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + totalDays * 24 * 60 * 60 * 1000,
    );

    const timeline = [
      `**Project Duration:** ${totalWeeks} weeks (${totalDays} working days)`,
      `**Start Date:** ${startDate.toLocaleDateString()}`,
      `**Target End Date:** ${endDate.toLocaleDateString()}`,
      "",
      "### Key Milestones",
      "",
    ];

    // Generate milestones based on phases
    const phases = this.generateProjectPhases(basis);
    let currentDate = new Date(startDate);

    phases.forEach((phase, index) => {
      const phaseEndDate = new Date(
        currentDate.getTime() + phase.duration * 24 * 60 * 60 * 1000,
      );
      timeline.push(`**Milestone ${index + 1}: ${phase.name}**`);
      timeline.push(`- Target Date: ${phaseEndDate.toLocaleDateString()}`);
      timeline.push(`- Duration: ${phase.duration} days`);
      timeline.push("");
      currentDate = phaseEndDate;
    });

    return timeline.join("\n");
  }

  /**
   * Generate team section
   */
  private generateTeamSection(basis: AnalysisReport): string {
    const uniqueAssignees = [
      ...new Set(basis.wbs.map((item) => item.assignee).filter(Boolean)),
    ];

    const team = [
      "**Core Team:**",
      "- **Project Manager (PM):** Overall project coordination and delivery",
      "- **Technical Lead (TL):** Architecture decisions and code review",
      "- **Product Owner (PO):** Requirements and acceptance criteria",
    ];

    if (uniqueAssignees.length > 0) {
      team.push("", "**Development Team:**");
      uniqueAssignees.forEach((assignee) => {
        team.push(`- **${assignee}:** Development and implementation`);
      });
    }

    // Add specialized roles based on WBS content
    if (basis.wbs.some((item) => item.title.toLowerCase().includes("gpu"))) {
      team.push("- **GPU Specialist:** GPU optimization and acceleration");
    }

    if (
      basis.wbs.some(
        (item) =>
          item.title.toLowerCase().includes("ml") ||
          item.title.toLowerCase().includes("search"),
      )
    ) {
      team.push("- **ML Engineer:** Machine learning and search optimization");
    }

    return team.join("\n");
  }

  /**
   * Generate success criteria
   */
  private generateSuccessCriteria(
    prompt: string,
    basis: AnalysisReport,
  ): string {
    const criteria = [
      "✅ All deliverables completed and approved",
      "✅ All WBS items marked as completed",
      "✅ Code quality gates passed (lint, type-check, tests)",
      "✅ Performance requirements met",
    ];

    // Add specific criteria based on prompt
    if (prompt.includes("20%") || prompt.includes("latency")) {
      criteria.push(
        "✅ Latency improvements achieved (measurable performance gains)",
      );
    }

    if (prompt.toLowerCase().includes("gpu")) {
      criteria.push("✅ GPU acceleration successfully implemented and tested");
    }

    if (basis.analysis.riskLevel === "high") {
      criteria.push("✅ All critical risks successfully mitigated");
    }

    return criteria.join("\n");
  }

  /**
   * Generate risks section
   */
  private generateRisksSection(basis: AnalysisReport): string {
    if (basis.risks.length === 0) {
      return "No specific risks identified at this time.";
    }

    const riskSections = basis.risks.map((risk, index) => {
      return `### Risk ${index + 1}: ${risk.description}
- **Impact:** ${risk.impact}
- **Probability:** ${risk.probability}
- **Category:** ${risk.category}
- **Owner:** ${risk.owner}
- **Mitigation:** ${risk.mitigation}`;
    });

    return riskSections.join("\n\n");
  }

  /**
   * Generate WBS section
   */
  private generateWBSSection(basis: AnalysisReport): string {
    if (basis.wbs.length === 0) {
      return "No WBS items identified.";
    }

    const wbsTable = [
      "| ID | Task | Estimated Hours | Priority | Status | Assignee |",
      "|----|------|----------------|----------|--------|----------|",
    ];

    basis.wbs.forEach((item) => {
      wbsTable.push(
        `| ${item.id} | ${item.title} | ${item.estimatedHours}h | ${item.priority} | ${item.status} | ${item.assignee || "TBD"} |`,
      );
    });

    const dependencies =
      basis.dependencies.length > 0
        ? "\n\n### Dependencies\n\n" +
          basis.dependencies
            .map((dep) => `- ${dep.from} → ${dep.to}: ${dep.description}`)
            .join("\n")
        : "";

    return wbsTable.join("\n") + dependencies;
  }

  /**
   * Generate project phases for timeline
   */
  private generateProjectPhases(basis: AnalysisReport) {
    const totalHours = basis.analysis.totalEstimatedHours;
    const totalDays = Math.ceil(totalHours / 8);

    return [
      {
        name: "Planning & Design",
        duration: Math.ceil(totalDays * 0.2), // 20% of project
      },
      {
        name: "Implementation",
        duration: Math.ceil(totalDays * 0.6), // 60% of project
      },
      {
        name: "Testing & Deployment",
        duration: Math.ceil(totalDays * 0.2), // 20% of project
      },
    ];
  }
}
