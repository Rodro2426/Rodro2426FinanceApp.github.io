// Assistant prompt and tool schemas, shared by the server (which calls Claude)
// and the app (which runs the tools against the user's on-device data).

export const MODEL = 'claude-opus-5-5';

export const CATEGORY_NAMES = ['Groceries', 'Food & dining', 'Transport', 'Entertainment', 'Personal care', 'Health', 'Home', 'Shopping', 'Education', 'Financial', 'Other'];

export interface AssistantContext { name: string; today: string; week: string; currency: string }

export function systemPrompt(c: AssistantContext) {
  return `You are the friendly money assistant inside "Pockets", a personal budgeting app. The user (${c.name}) lives in Colombia; amounts are in ${c.currency}. Today is ${c.today}, ${c.week}. The user sets a monthly income and splits it into weekly pockets; leftover pocket money can move to other pockets or savings goals.
Rules: Reply in the same language the user writes or speaks. Be brief and warm: 1–3 short sentences, plain text, no markdown, no bullet lists unless listing pockets. Always call get_overview before answering about their money or before logging something whose pocket is unclear. When the user says they spent or paid for something, call add_expense right away with the best-matching existing pocket (don't ask unless truly ambiguous) and mention what's left in that pocket. Colombian slang: "mil" = thousand, "luca(s)" = 1.000 each, "palo" = 1.000.000. When asked to build a budget, propose specific weekly amounts that fit their income and create them with create_pocket / set_pocket_budget, then summarize. Never invent data.`;
}

export const TOOL_NAMES = ['get_overview', 'add_expense', 'create_pocket', 'set_pocket_budget', 'set_income', 'move_money', 'create_goal'] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const TOOLS: { name: ToolName; description: string; input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] } }[] = [
  {
    name: 'get_overview',
    description: "Read the user's current finances: income, weekly pockets with spent/left, accounts and credit cards, goals, bills, tags and recent expenses. Call this before answering questions about their money.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'add_expense',
    description: 'Log an expense the user made. Use an existing pocket name exactly. Amount is a plain number in the account currency (e.g. "45 mil" = 45000, "una luca" = 1000).',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        pocket: { type: 'string' },
        note: { type: 'string', description: 'Short description, e.g. merchant' },
        account: { type: 'string', description: 'Account or card name; omit to use the main checking account' },
        tags: { type: 'array', items: { type: 'string' } },
        category: { type: 'string', description: 'One of: ' + CATEGORY_NAMES.join(', ') },
        subcategory: { type: 'string' }
      },
      required: ['amount', 'pocket', 'note']
    }
  },
  {
    name: 'create_pocket',
    description: 'Create a new weekly pocket (budget category), or update it if one with that name exists.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, weekly_amount: { type: 'number' } }, required: ['name', 'weekly_amount'] }
  },
  {
    name: 'set_pocket_budget',
    description: "Change an existing pocket's weekly budget.",
    input_schema: { type: 'object', properties: { pocket: { type: 'string' }, weekly_amount: { type: 'number' } }, required: ['pocket', 'weekly_amount'] }
  },
  {
    name: 'set_income',
    description: "Set the user's monthly income.",
    input_schema: { type: 'object', properties: { monthly_amount: { type: 'number' } }, required: ['monthly_amount'] }
  },
  {
    name: 'move_money',
    description: "Move leftover money this week from one pocket to another pocket or to a savings goal. Can't move more than the source has left.",
    input_schema: { type: 'object', properties: { from_pocket: { type: 'string' }, to: { type: 'string', description: 'Pocket or goal name' }, amount: { type: 'number' } }, required: ['from_pocket', 'to', 'amount'] }
  },
  {
    name: 'create_goal',
    description: 'Create a savings goal.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, target: { type: 'number' }, months: { type: 'number' }, already_saved: { type: 'number' } }, required: ['name', 'target', 'months'] }
  }
];
