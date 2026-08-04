import type { PresetCall } from '../types';

// Tool category presets — extend this file to add presets for your MCP server.
//
// Presets organize tools into browsable categories in the sidebar.
// Tools not matching any preset are grouped under "Other".
//
// Example: To add presets for a custom MCP server, add entries like:
//
//   'my-tool-name': {
//     description: 'What the tool does',
//     category: 'My Category',
//     args: { param1: 'default' }
//   }

export interface ToolPreset {
  description: string;
  category: string;
  args?: Record<string, unknown>;
}

// ─── Actual Budget MCP Presets ───────────────────────────────────────────────
// These presets are designed for the Actual Budget MCP Server.
// See: https://github.com/guitarbeat/Actual-MCP-Server
// Remove or replace these with presets for your own MCP server.

export const TOOL_PRESETS: Record<string, ToolPreset> = {
  // Accounts
  'get-accounts': { description: 'List all accounts', category: '🏦 Accounts' },
  'get-account-balance': {
    description: 'Get account balance',
    category: '🏦 Accounts',
    args: { accountId: '' },
  },
  'create-account': {
    description: 'Create a new account',
    category: '🏦 Accounts',
    args: { name: '', type: 'checking' },
  },
  'update-account': {
    description: 'Update account details',
    category: '🏦 Accounts',
    args: { id: '' },
  },
  'delete-account': { description: 'Delete an account', category: '🏦 Accounts', args: { id: '' } },
  'close-account': {
    description: 'Close (archive) an account',
    category: '🏦 Accounts',
    args: { id: '' },
  },
  'reopen-account': {
    description: 'Reopen a closed account',
    category: '🏦 Accounts',
    args: { id: '' },
  },

  // Transactions
  'get-transactions': {
    description: 'Query transactions with filters',
    category: '💳 Transactions',
    args: { accountId: '' },
  },
  'create-transaction': {
    description: 'Create a new transaction',
    category: '💳 Transactions',
    args: { accountId: '', date: '', amount: 0 },
  },
  'update-transaction': {
    description: 'Update a transaction',
    category: '💳 Transactions',
    args: { id: '' },
  },
  'delete-transaction': {
    description: 'Delete a transaction',
    category: '💳 Transactions',
    args: { id: '' },
  },
  'import-transactions': {
    description: 'Bulk import transactions',
    category: '💳 Transactions',
    args: { accountId: '', transactions: [] },
  },

  // Categories
  'get-categories': { description: 'List all categories', category: '📂 Categories' },
  'create-category': {
    description: 'Create a new category',
    category: '📂 Categories',
    args: { name: '', groupId: '' },
  },
  'update-category': {
    description: 'Update a category',
    category: '📂 Categories',
    args: { id: '' },
  },
  'delete-category': {
    description: 'Delete a category',
    category: '📂 Categories',
    args: { id: '' },
  },
  'get-category-groups': { description: 'List category groups', category: '📂 Categories' },
  'create-category-group': {
    description: 'Create a category group',
    category: '📂 Categories',
    args: { name: '' },
  },
  'update-category-group': {
    description: 'Update a category group',
    category: '📂 Categories',
    args: { id: '' },
  },
  'delete-category-group': {
    description: 'Delete a category group',
    category: '📂 Categories',
    args: { id: '' },
  },

  // Payees
  'get-payees': { description: 'List all payees', category: '👤 Payees' },
  'create-payee': { description: 'Create a new payee', category: '👤 Payees', args: { name: '' } },
  'update-payee': { description: 'Update a payee', category: '👤 Payees', args: { id: '' } },
  'delete-payee': { description: 'Delete a payee', category: '👤 Payees', args: { id: '' } },

  // Budget
  'get-budget-month': {
    description: 'Get budget data for a month',
    category: '📊 Budget',
    args: { month: '' },
  },
  'set-budget-amount': {
    description: 'Set budget for a category',
    category: '📊 Budget',
    args: { month: '', categoryId: '', amount: 0 },
  },
  'get-budget-summary': {
    description: 'Budget summary with variances',
    category: '📊 Budget',
    args: { month: '' },
  },

  // Analytics
  'spending-by-category': {
    description: 'Spending breakdown by category',
    category: '📈 Analytics',
    args: { startDate: '', endDate: '' },
  },
  'spending-trends': {
    description: 'Monthly spending trends',
    category: '📈 Analytics',
    args: { startDate: '', endDate: '' },
  },
  'monthly-summary': {
    description: 'Full monthly financial summary',
    category: '📈 Analytics',
    args: { month: '' },
  },

  // Rules & Schedules
  'get-rules': { description: 'List transaction rules', category: '⚙️ Rules' },
  'create-rule': {
    description: 'Create a transaction rule',
    category: '⚙️ Rules',
    args: { conditions: [], actions: [] },
  },
  'update-rule': { description: 'Update a rule', category: '⚙️ Rules', args: { id: '' } },
  'delete-rule': { description: 'Delete a rule', category: '⚙️ Rules', args: { id: '' } },
  'get-schedules': { description: 'List scheduled transactions', category: '⚙️ Rules' },

  // Transfers & Auditing
  'audit-historical-transfers': {
    description: 'Find transfer candidates',
    category: '🔍 Auditing',
  },
  'apply-transfer-links': {
    description: 'Link matched transfers',
    category: '🔍 Auditing',
    args: { pairs: [] },
  },
  'bank-sync': { description: 'Sync with bank', category: '🔍 Auditing', args: { accountId: '' } },
};

// Helper: get unique categories from presets
export function getCategories(): string[] {
  const cats = new Set(Object.values(TOOL_PRESETS).map((p) => p.category));
  return Array.from(cats).sort();
}

function toolLabel(tool: string): string {
  return tool
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const PRESETS: PresetCall[] = Object.entries(TOOL_PRESETS).map(([tool, preset]) => ({
  id: tool,
  label: toolLabel(tool),
  description: preset.description,
  icon: preset.category.split(' ')[0] || '⚡',
  tool,
  args: preset.args ?? {},
  category: preset.category,
}));
