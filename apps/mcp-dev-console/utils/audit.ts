import { McpTool, SchemaProperty } from '../types';

// ── Types ──────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface AuditIssue {
  severity: Severity;
  code: string;
  message: string;
  suggestion?: string;
}

export interface ToolChecks {
  hasDescription: boolean;
  descriptionLength: number;
  descriptionQuality: 'good' | 'short' | 'missing';
  hasInputSchema: boolean;
  paramCount: number;
  paramsWithTypes: number;
  paramsWithDescriptions: number;
  paramsWithoutDescriptions: string[];
  paramsWithoutTypes: string[];
  hasRequiredFields: boolean;
  namingConvention: string | null; // e.g. "get-", "create-", etc.
  namingValid: boolean;
}

export interface ToolAuditResult {
  toolName: string;
  score: number;
  grade: Grade;
  issues: AuditIssue[];
  checks: ToolChecks;
}

export interface AuditSummary {
  totalTools: number;
  overallScore: number;
  overallGrade: Grade;
  gradeDistribution: Record<Grade, number>;
  topIssues: { code: string; message: string; count: number }[];
  results: ToolAuditResult[];
  timestamp: Date;
}

// ── Constants ──────────────────────────────────────────────────────

const KNOWN_PREFIXES = [
  'get-',
  'create-',
  'update-',
  'delete-',
  'list-',
  'search-',
  'manage-',
  'set-',
  'add-',
  'remove-',
  'import-',
  'export-',
  'sync-',
  'run-',
  'check-',
  'validate-',
  'close-',
  'reopen-',
];

const GENERIC_PARAM_NAMES = new Set([
  'data',
  'value',
  'input',
  'payload',
  'params',
  'options',
  'stuff',
  'thing',
]);

// ── Scoring weights (total = 100) ─────────────────────────────────

const WEIGHTS = {
  description: 15, // Has any description
  descriptionDepth: 10, // Description > 30 chars
  hasSchema: 10, // Has inputSchema defined
  paramTypes: 15, // All params have types
  paramDescriptions: 25, // All params have descriptions
  requiredFields: 10, // Required array defined when params exist
  namingConvention: 10, // Follows verb-noun naming
  noGenericNames: 5, // No params with generic names
};

// ── Grading ───────────────────────────────────────────────────────

export function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

const GRADE_COLORS: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-info',
  C: 'text-warning',
  D: 'text-error',
  F: 'text-error',
};

export function gradeColor(grade: Grade): string {
  return GRADE_COLORS[grade];
}

const GRADE_BG: Record<Grade, string> = {
  A: 'bg-success/15',
  B: 'bg-info/15',
  C: 'bg-warning/15',
  D: 'bg-error/10',
  F: 'bg-error/15',
};

export function gradeBg(grade: Grade): string {
  return GRADE_BG[grade];
}

// ── Audit a single tool ───────────────────────────────────────────

export function auditTool(tool: McpTool): ToolAuditResult {
  const issues: AuditIssue[] = [];
  let score = 0;

  const desc = (tool.description || '').trim();
  const props = tool.inputSchema?.properties || {};
  const propEntries = Object.entries(props) as Array<[string, SchemaProperty]>;
  const required = tool.inputSchema?.required || [];

  // ── Description ──
  const hasDescription = desc.length > 0;
  const descriptionLength = desc.length;
  let descriptionQuality: 'good' | 'short' | 'missing' = 'missing';

  if (!hasDescription) {
    issues.push({
      severity: 'error',
      code: 'NO_DESCRIPTION',
      message: 'Tool has no description',
      suggestion: 'Add a clear description explaining what the tool does and when to use it',
    });
  } else {
    score += WEIGHTS.description;
    if (desc.length >= 30) {
      score += WEIGHTS.descriptionDepth;
      descriptionQuality = 'good';
    } else {
      descriptionQuality = 'short';
      issues.push({
        severity: 'warning',
        code: 'SHORT_DESCRIPTION',
        message: `Description is only ${desc.length} chars (recommend ≥30)`,
        suggestion: 'Expand description to explain purpose, expected inputs, and behavior',
      });
    }
  }

  // ── Input schema ──
  const hasInputSchema = !!tool.inputSchema;
  if (!hasInputSchema) {
    issues.push({
      severity: 'warning',
      code: 'NO_INPUT_SCHEMA',
      message: 'No inputSchema defined',
      suggestion:
        'Define an inputSchema even for zero-arg tools (use { type: "object", properties: {} })',
    });
  } else {
    score += WEIGHTS.hasSchema;
  }

  // ── Param types ──
  const paramsWithTypes: string[] = [];
  const paramsWithoutTypes: string[] = [];
  const paramsWithDescriptions: string[] = [];
  const paramsWithoutDescriptions: string[] = [];

  for (const [name, prop] of propEntries) {
    if (prop.type) paramsWithTypes.push(name);
    else paramsWithoutTypes.push(name);

    if (prop.description && prop.description.trim().length > 0) paramsWithDescriptions.push(name);
    else paramsWithoutDescriptions.push(name);
  }

  const paramCount = propEntries.length;

  if (paramCount > 0) {
    // Type coverage
    const typeCoverage = paramsWithTypes.length / paramCount;
    score += Math.round(WEIGHTS.paramTypes * typeCoverage);
    if (paramsWithoutTypes.length > 0) {
      issues.push({
        severity: 'error',
        code: 'MISSING_PARAM_TYPES',
        message: `${paramsWithoutTypes.length} param(s) missing type: ${paramsWithoutTypes.join(', ')}`,
        suggestion: 'Add explicit type to each parameter (string, number, boolean, array, object)',
      });
    }

    // Description coverage
    const descCoverage = paramsWithDescriptions.length / paramCount;
    score += Math.round(WEIGHTS.paramDescriptions * descCoverage);
    if (paramsWithoutDescriptions.length > 0) {
      issues.push({
        severity: paramsWithoutDescriptions.length > paramCount / 2 ? 'error' : 'warning',
        code: 'MISSING_PARAM_DESCRIPTIONS',
        message: `${paramsWithoutDescriptions.length}/${paramCount} params lack descriptions: ${paramsWithoutDescriptions.join(', ')}`,
        suggestion: 'Add a description to every parameter explaining what it does and valid values',
      });
    }

    // Required fields
    const hasRequiredFields = required.length > 0;
    if (hasRequiredFields) {
      score += WEIGHTS.requiredFields;
    } else {
      issues.push({
        severity: 'warning',
        code: 'NO_REQUIRED_FIELDS',
        message: 'No required fields defined despite having parameters',
        suggestion: 'Mark essential params as required in the inputSchema.required array',
      });
    }

    // Generic names
    const genericParams = propEntries
      .filter(([name]) => GENERIC_PARAM_NAMES.has(name.toLowerCase()))
      .map(([name]) => name);
    if (genericParams.length === 0) {
      score += WEIGHTS.noGenericNames;
    } else {
      issues.push({
        severity: 'info',
        code: 'GENERIC_PARAM_NAMES',
        message: `Generic param names: ${genericParams.join(', ')}`,
        suggestion: 'Use specific, descriptive names (e.g., "accountId" instead of "data")',
      });
    }
  } else {
    // No params — give full marks for param-related checks
    score +=
      WEIGHTS.paramTypes +
      WEIGHTS.paramDescriptions +
      WEIGHTS.requiredFields +
      WEIGHTS.noGenericNames;
  }

  // ── Naming convention ──
  const toolName = tool.name.toLowerCase();
  const matchedPrefix = KNOWN_PREFIXES.find((p) => toolName.startsWith(p));
  const namingValid = !!matchedPrefix || toolName.includes('-');

  if (namingValid) {
    score += WEIGHTS.namingConvention;
  } else {
    issues.push({
      severity: 'info',
      code: 'NAMING_CONVENTION',
      message: `Tool name "${tool.name}" doesn't follow verb-noun pattern`,
      suggestion: `Use a prefix like ${KNOWN_PREFIXES.slice(0, 5).join(', ')} (e.g., "get-${tool.name}")`,
    });
  }

  // Sort issues by severity
  const severityOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    toolName: tool.name,
    score: Math.min(100, Math.max(0, score)),
    grade: scoreToGrade(score),
    issues,
    checks: {
      hasDescription,
      descriptionLength,
      descriptionQuality,
      hasInputSchema,
      paramCount,
      paramsWithTypes: paramsWithTypes.length,
      paramsWithDescriptions: paramsWithDescriptions.length,
      paramsWithoutDescriptions,
      paramsWithoutTypes,
      hasRequiredFields: required.length > 0,
      namingConvention: matchedPrefix || null,
      namingValid,
    },
  };
}

// ── Audit all tools ───────────────────────────────────────────────

export function auditAllTools(tools: McpTool[]): AuditSummary {
  const results = tools.map(auditTool);
  results.sort((a, b) => a.score - b.score); // worst first

  const overallScore =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0;

  const gradeDistribution: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const r of results) gradeDistribution[r.grade]++;

  // Aggregate top issues by code
  const issueCounts = new Map<string, { message: string; count: number }>();
  for (const r of results) {
    for (const issue of r.issues) {
      const existing = issueCounts.get(issue.code);
      if (existing) existing.count++;
      else issueCounts.set(issue.code, { message: issue.message, count: 1 });
    }
  }
  const topIssues = Array.from(issueCounts.entries())
    .map(([code, { message, count }]) => ({ code, message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalTools: tools.length,
    overallScore,
    overallGrade: scoreToGrade(overallScore),
    gradeDistribution,
    topIssues,
    results,
    timestamp: new Date(),
  };
}

// ── Export as Markdown ────────────────────────────────────────────

export function auditToMarkdown(summary: AuditSummary): string {
  const lines: string[] = [
    `# MCP Schema Audit Report`,
    ``,
    `**Overall Grade: ${summary.overallGrade}** (${summary.overallScore}/100)  `,
    `**Tools analyzed:** ${summary.totalTools}  `,
    `**Date:** ${summary.timestamp.toISOString().slice(0, 10)}`,
    ``,
    `## Grade Distribution`,
    ``,
    `| Grade | Count |`,
    `|-------|-------|`,
  ];

  for (const g of ['A', 'B', 'C', 'D', 'F'] as Grade[]) {
    if (summary.gradeDistribution[g] > 0) {
      lines.push(`| ${g} | ${summary.gradeDistribution[g]} |`);
    }
  }

  lines.push(``, `## Top Issues`, ``);
  for (const issue of summary.topIssues) {
    lines.push(`- **${issue.code}** — ${issue.count} tool(s)`);
  }

  lines.push(``, `## Per-Tool Results`, ``);
  lines.push(`| Tool | Grade | Score | Issues |`);
  lines.push(`|------|-------|-------|--------|`);
  for (const r of summary.results) {
    lines.push(`| \`${r.toolName}\` | ${r.grade} | ${r.score} | ${r.issues.length} |`);
  }

  lines.push(``, `## Detailed Issues`, ``);
  for (const r of summary.results) {
    if (r.issues.length === 0) continue;
    lines.push(`### \`${r.toolName}\` — ${r.grade} (${r.score}/100)`, ``);
    for (const issue of r.issues) {
      const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`- ${icon} ${issue.message}`);
      if (issue.suggestion) lines.push(`  - 💡 ${issue.suggestion}`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}
