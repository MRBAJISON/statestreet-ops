import {
  Activity,
  ArrowRightLeft,
  BadgeDollarSign,
  Banknote,
  CalendarRange,
  CircleGauge,
  ClipboardCheck,
  ContactRound,
  Crosshair,
  HeartHandshake,
  Landmark,
  Megaphone,
  MessageSquareText,
  PackageCheck,
  PackageSearch,
  RefreshCcw,
  ReceiptText,
  ScanLine,
  ScanSearch,
  Send,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Target,
  TrendingUp,
  UserRoundCheck,
  UsersRound,
  WalletCards,
  Wrench,
  FileSpreadsheet,
} from 'lucide-react';
import type { WorkflowDefinition, WorkflowFieldDefinition, WorkflowShortcut } from './workflow-config';
import { actionFields, option, storeField, todayField } from './workflow-config';

const countField = (name: string, label: string, required = true): WorkflowFieldDefinition => ({
  name,
  label,
  type: 'number',
  required,
  min: 0,
  step: 1,
  defaultValue: required ? '0' : '',
});

const moneyField = (name: string, label: string, required = true): WorkflowFieldDefinition => ({
  name,
  label,
  type: 'money',
  required,
  min: 0,
  step: 0.01,
});

const scoreField = (name: string, label: string, required = true, max = 100): WorkflowFieldDefinition => ({
  name,
  label,
  type: 'score',
  required,
  min: 0,
  max,
  step: 1,
});

const notesField = (name = 'notes', label = 'Notes'): WorkflowFieldDefinition => ({
  name,
  label,
  type: 'textarea',
  fullWidth: true,
  maxLength: 2000,
});

const feedbackFields: WorkflowFieldDefinition[] = [
  todayField(),
  { name: 'source', label: 'Source', type: 'text', required: true, placeholder: 'In-store, WhatsApp, Google' },
  { name: 'type', label: 'Feedback type', type: 'text', required: true, placeholder: 'Praise, complaint, request' },
  { name: 'category', label: 'Category', type: 'text' },
  { name: 'npsScore', label: 'NPS response', type: 'number', min: 0, max: 10, step: 1 },
  {
    name: 'recommendation',
    label: 'Would recommend',
    type: 'select',
    options: [option('yes', 'Yes'), option('likely', 'Likely'), option('no', 'No')],
  },
  { name: 'frequency', label: 'Visit frequency', type: 'text' },
  storeField(false),
  { name: 'brandId', label: 'Brand', type: 'select', reference: 'brands' },
  { name: 'detail', label: 'Feedback', type: 'textarea', required: true, fullWidth: true, maxLength: 3000 },
  { name: 'contactName', label: 'Contact name', type: 'text' },
  { name: 'contactValue', label: 'Phone or email', type: 'text' },
  {
    name: 'contactConsent',
    label: 'Contact consent recorded',
    type: 'switch',
    showWhen: { field: 'contactValue', truthy: true },
    fullWidth: true,
  },
  {
    name: 'retentionUntil',
    label: 'Retain contact until',
    type: 'date',
    showWhen: { field: 'contactValue', truthy: true },
    defaultPreset: 'retention-end',
    minDatePreset: 'today',
    maxDatePreset: 'retention-end',
  },
];

const targetFields: WorkflowFieldDefinition[] = [
  {
    name: 'metric',
    label: 'Metric',
    type: 'select',
    required: true,
    options: [
      option('net-revenue', 'Net revenue'),
      option('gross-profit', 'Gross profit'),
      option('operating-profit', 'Operating profit'),
      option('gross-margin', 'Gross margin'),
      option('units', 'Units'),
      option('conversion-rate', 'Conversion rate'),
    ],
  },
  {
    name: 'scopeType',
    label: 'Scope',
    type: 'select',
    required: true,
    defaultValue: 'group',
    options: [option('group', 'Group'), option('store', 'Store'), option('brand', 'Brand'), option('category', 'Category')],
  },
  { ...storeField(true), showWhen: { field: 'scopeType', equals: 'store' } },
  { name: 'brandId', label: 'Brand', type: 'select', reference: 'brands', required: true, showWhen: { field: 'scopeType', equals: 'brand' } },
  { name: 'categoryId', label: 'Category', type: 'select', reference: 'categories', required: true, showWhen: { field: 'scopeType', equals: 'category' } },
  {
    name: 'periodType',
    label: 'Period',
    type: 'select',
    required: true,
    defaultValue: 'month',
    options: [option('day', 'Day'), option('week', 'Week'), option('month', 'Month'), option('quarter', 'Quarter'), option('year', 'Year')],
  },
  { name: 'periodStart', label: 'Starts', type: 'date', required: true, defaultPreset: 'month-start' },
  { name: 'periodEnd', label: 'Ends', type: 'date', required: false, defaultPreset: 'month-end', description: 'Leave blank on a recurring target to keep it active indefinitely.' },
  { name: 'recurring', label: 'Repeat automatically', type: 'switch', defaultValue: false, description: 'Apply this same target to each day, week, or month from the start date onward.' },
  moneyField('value', 'Target value'),
  {
    name: 'unit',
    label: 'Unit',
    type: 'select',
    required: true,
    defaultValue: 'money',
    options: [option('money', 'Money'), option('percent', 'Percent'), option('count', 'Count'), option('ratio', 'Ratio')],
  },
];

const productFields: WorkflowFieldDefinition[] = [
  { name: 'sku', label: 'SKU', type: 'text', required: true, placeholder: 'SKU-001' },
  { name: 'name', label: 'Product name', type: 'text', required: true },
  { name: 'brandId', label: 'Brand', type: 'select', reference: 'brands', required: true },
  { name: 'categoryId', label: 'Category', type: 'select', reference: 'categories', required: true },
  { name: 'size', label: 'Size', type: 'text' },
  { name: 'color', label: 'Color', type: 'text' },
  moneyField('unitCost', 'Unit cost', false),
  moneyField('sellingPrice', 'Selling price', false),
  { name: 'description', label: 'Description', type: 'textarea', fullWidth: true, maxLength: 2000 },
];

export const financeWorkflows: WorkflowDefinition[] = [
  {
    id: 'expense', title: 'Record expense', group: 'Daily finance', icon: ReceiptText, tone: 'coral',
    fields: [
      todayField(),
      { name: 'expenseCategoryId', label: 'Expense category', type: 'select', reference: 'expenseCategories', required: true },
      storeField(false),
      moneyField('amount', 'Amount'),
      { name: 'vendor', label: 'Vendor', type: 'text' },
      { name: 'invoiceReference', label: 'Invoice reference', type: 'text' },
      { name: 'paymentMethodId', label: 'Payment method', type: 'select', reference: 'paymentMethods' },
      { name: 'description', label: 'Description', type: 'textarea', required: true, fullWidth: true },
      { name: 'overspendReason', label: 'Overspend reason', type: 'textarea', fullWidth: true },
    ],
  },
  {
    id: 'cash-transaction', title: 'Cash transaction', group: 'Daily finance', icon: Banknote, tone: 'teal',
    fields: [
      todayField(),
      { name: 'direction', label: 'Direction', type: 'select', required: true, defaultValue: 'outflow', options: [option('inflow', 'Inflow'), option('outflow', 'Outflow')] },
      { name: 'category', label: 'Category', type: 'text', required: true },
      moneyField('amount', 'Amount'),
      { name: 'expenseCategoryId', label: 'Expense category', type: 'select', reference: 'expenseCategories' },
      { name: 'cashAccountId', label: 'Cash account', type: 'select', reference: 'cashAccounts' },
      { name: 'reference', label: 'Reference', type: 'text' },
      notesField('description', 'Description'),
    ],
  },
  {
    id: 'budget', title: 'Set annual budget', group: 'Planning', icon: WalletCards, tone: 'blue',
    fields: [
      { name: 'year', label: 'Year', type: 'number', required: true, min: 2000, max: 2200, defaultPreset: 'year' },
      { name: 'expenseCategoryId', label: 'Expense category', type: 'select', reference: 'expenseCategories', required: true },
      storeField(false),
      moneyField('amount', 'Annual budget'),
      notesField(),
    ],
  },
  {
    id: 'forecast', title: 'Financial forecast', group: 'Planning', icon: TrendingUp, tone: 'green',
    fields: [
      { name: 'periodStart', label: 'Starts', type: 'date', required: true, defaultPreset: 'month-start' },
      { name: 'periodEnd', label: 'Ends', type: 'date', required: true, defaultPreset: 'month-end' },
      moneyField('revenue', 'Revenue'),
      moneyField('grossProfit', 'Gross profit'),
      moneyField('netProfit', 'Net profit'),
      moneyField('cashBalance', 'Cash balance'),
      { name: 'confidence', label: 'Confidence', type: 'select', required: true, defaultValue: 'medium', options: [option('low', 'Low'), option('medium', 'Medium'), option('high', 'High')] },
      notesField('assumptions', 'Assumptions'),
    ],
  },
  {
    id: 'working-capital', title: 'Working capital item', group: 'Position', icon: Landmark, tone: 'amber',
    fields: [
      { name: 'type', label: 'Type', type: 'select', required: true, defaultValue: 'debtor', options: [option('debtor', 'Debtor'), option('creditor', 'Creditor')] },
      { name: 'entity', label: 'Customer or supplier', type: 'text', required: true },
      moneyField('originalAmount', 'Original amount'),
      { name: 'dueDate', label: 'Due date', type: 'date' },
      notesField(),
    ],
  },
  {
    id: 'capital-snapshot', title: 'Capital snapshot', group: 'Position', icon: BadgeDollarSign, tone: 'orchid',
    fields: [
      { name: 'year', label: 'Year', type: 'number', required: true, min: 2000, max: 2200, defaultPreset: 'year' },
      moneyField('capitalEmployed', 'Capital employed'),
      moneyField('totalInvestment', 'Total investment'),
      notesField(),
    ],
  },
  { id: 'action', title: 'Finance action', group: 'Accountability', icon: ClipboardCheck, tone: 'green', fields: actionFields('finance') },
];

export const commercialWorkflows: WorkflowDefinition[] = [
  { id: 'target', title: 'Set performance target', group: 'Planning', icon: Target, tone: 'green', fields: targetFields },
  { id: 'product', title: 'Add product', group: 'Products', icon: ShoppingBag, tone: 'blue', endpoint: '/api/products', fields: productFields },
  {
    id: 'product-insight', title: 'Product insight', group: 'Products', icon: ScanSearch, tone: 'orchid',
    fields: [
      { name: 'productId', label: 'Product', type: 'product', required: true, fullWidth: true },
      { name: 'periodStart', label: 'Starts', type: 'date', required: true, defaultPreset: 'month-start' },
      { name: 'periodEnd', label: 'Ends', type: 'date', required: true, defaultPreset: 'month-end' },
      { name: 'status', label: 'Stock status', type: 'select', required: true, defaultValue: 'active', options: [option('active', 'Active'), option('slow', 'Slow moving'), option('dead', 'Dead stock'), option('out-of-stock', 'Out of stock')] },
      { name: 'performance', label: 'Performance', type: 'select', options: [option('strong', 'Strong'), option('steady', 'Steady'), option('underperforming', 'Underperforming')] },
      countField('unitsSold', 'Units sold', false),
      countField('currentStock', 'Current stock', false),
      { name: 'sellThroughPercent', label: 'Sell-through %', type: 'number', min: 0, max: 100, step: 0.1 },
      moneyField('salesValue', 'Sales value', false),
      countField('daysInStock', 'Days in stock', false),
      { name: 'campaign', label: 'Campaign', type: 'text' },
      notesField('insight', 'Commercial insight'),
    ],
  },
  { id: 'action', title: 'Commercial action', group: 'Accountability', icon: Crosshair, tone: 'amber', fields: actionFields('commercial') },
];

export const marketingWorkflows: WorkflowDefinition[] = [
  {
    id: 'campaign', title: 'Campaign performance', group: 'Performance', icon: Megaphone, tone: 'orchid',
    fields: [
      todayField(),
      { name: 'name', label: 'Campaign', type: 'text', required: true },
      { name: 'brandId', label: 'Brand', type: 'select', reference: 'brands', required: true },
      { name: 'platform', label: 'Platform', type: 'text', required: true },
      countField('reach', 'Reach'),
      countField('engagement', 'Engagement'),
      countField('storeVisits', 'Store visits'),
      moneyField('revenueInfluenced', 'Revenue influenced'),
      moneyField('spend', 'Spend'),
      { name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'active', options: [option('planned', 'Planned'), option('active', 'Active'), option('paused', 'Paused'), option('completed', 'Completed')] },
    ],
  },
  {
    id: 'lead-metric', title: 'Lead channel summary', group: 'Performance', icon: UsersRound, tone: 'blue',
    fields: [
      todayField(),
      { name: 'channel', label: 'Channel', type: 'text', required: true },
      countField('leadCount', 'Leads'),
      countField('qualifiedCount', 'Qualified'),
      countField('convertedCount', 'Converted'),
      moneyField('averageValue', 'Average value', false),
      notesField(),
    ],
  },
  {
    id: 'social-metric', title: 'Social channel snapshot', group: 'Channels', icon: Send, tone: 'coral',
    fields: [
      todayField(),
      { name: 'platform', label: 'Platform', type: 'text', required: true },
      { name: 'brandId', label: 'Brand', type: 'select', reference: 'brands' },
      countField('followers', 'Followers'),
      countField('posts', 'Posts'),
      countField('reels', 'Reels'),
      countField('stories', 'Stories'),
      countField('reach', 'Reach'),
      countField('impressions', 'Impressions'),
      countField('engagement', 'Engagement'),
      countField('clicks', 'Clicks'),
      countField('websiteVisits', 'Website visits'),
    ],
  },
  {
    id: 'clienteling', title: 'Clienteling activity', group: 'Customers', icon: HeartHandshake, tone: 'teal',
    fields: [
      todayField(),
      { name: 'type', label: 'Activity type', type: 'text', required: true, placeholder: 'WhatsApp, calls, appointments' },
      storeField(false),
      countField('contacted', 'Contacted'),
      countField('responses', 'Responses'),
      countField('appointments', 'Appointments'),
      moneyField('estimatedRevenue', 'Estimated revenue'),
      notesField(),
    ],
  },
  { id: 'feedback', title: 'Customer feedback', group: 'Customers', icon: MessageSquareText, tone: 'amber', fields: feedbackFields },
  { id: 'action', title: 'Marketing action', group: 'Accountability', icon: ClipboardCheck, tone: 'green', fields: actionFields('marketing') },
];

export const operationsWorkflows: WorkflowDefinition[] = [
  {
    id: 'store-standard', title: 'Store standards review', group: 'Store execution', icon: Store, tone: 'green',
    fields: [
      todayField(), storeField(true),
      scoreField('operationsScore', 'Operations'), scoreField('vmScore', 'Visual merchandising'),
      scoreField('readinessScore', 'Readiness'), scoreField('customerExperienceScore', 'Customer experience'),
      scoreField('cleanlinessScore', 'Cleanliness'), scoreField('safetyScore', 'Safety'),
      notesField('issues', 'Issues'),
    ],
  },
  {
    id: 'vm-review', title: 'Visual merchandising review', group: 'Store execution', icon: Sparkles, tone: 'orchid',
    fields: [
      todayField(), storeField(true),
      scoreField('windowDisplayScore', 'Window display'), scoreField('mannequinScore', 'Mannequins'),
      scoreField('productPresentationScore', 'Product presentation'), scoreField('sizeArrangementScore', 'Size arrangement'),
      notesField('improvements', 'Improvements'),
    ],
  },
  {
    id: 'store-experience', title: 'Store experience', group: 'Store execution', icon: Star, tone: 'amber',
    fields: [
      todayField(), storeField(true),
      { name: 'category', label: 'Assessment area', type: 'text', required: true },
      { name: 'rating', label: 'Rating', type: 'number', required: true, min: 1, max: 5, step: 1 },
      { name: 'npsScore', label: 'NPS response', type: 'number', min: 0, max: 10, step: 1 },
      { name: 'recommendation', label: 'Would recommend', type: 'select', options: [option('yes', 'Yes'), option('likely', 'Likely'), option('no', 'No')] },
      notesField('comments', 'Comments'),
    ],
  },
  {
    id: 'maintenance', title: 'Maintenance request', group: 'Issues', icon: Wrench, tone: 'coral',
    fields: [
      todayField(), storeField(true),
      { name: 'category', label: 'Category', type: 'text', required: true },
      { name: 'priority', label: 'Priority', type: 'select', required: true, defaultValue: 'medium', options: [option('low', 'Low'), option('medium', 'Medium'), option('high', 'High'), option('critical', 'Critical')] },
      { name: 'description', label: 'Description', type: 'textarea', required: true, fullWidth: true },
      { name: 'assignedToUserId', label: 'Assigned user', type: 'select', reference: 'users' },
      { name: 'assignedToName', label: 'External assignee', type: 'text' },
      moneyField('estimatedCost', 'Estimated cost', false),
      { name: 'dueDate', label: 'Due date', type: 'date' },
    ],
  },
  {
    id: 'incident', title: 'Incident report', group: 'Issues', icon: ShieldAlert, tone: 'coral',
    fields: [
      { name: 'occurredAt', label: 'Occurred at', type: 'datetime', required: true, defaultPreset: 'now' },
      storeField(true),
      { name: 'type', label: 'Incident type', type: 'text', required: true },
      { name: 'severity', label: 'Severity', type: 'select', required: true, defaultValue: 'medium', options: [option('low', 'Low'), option('medium', 'Medium'), option('high', 'High'), option('critical', 'Critical')] },
      { name: 'description', label: 'Description', type: 'textarea', required: true, fullWidth: true },
      notesField('immediateAction', 'Immediate action'),
      { name: 'followUpRequired', label: 'Follow-up required', type: 'switch', fullWidth: true },
    ],
  },
  {
    id: 'sop-review', title: 'SOP review', group: 'Compliance', icon: ClipboardCheck, tone: 'blue',
    fields: [
      todayField(), storeField(true),
      { name: 'area', label: 'SOP area', type: 'text', required: true },
      scoreField('complianceScore', 'Compliance score'),
      notesField('deviations', 'Deviations'), notesField('correctiveAction', 'Corrective action'),
    ],
  },
  {
    id: 'people', title: 'People snapshot', group: 'Compliance', icon: UserRoundCheck, tone: 'teal',
    fields: [
      todayField(), storeField(true),
      countField('staffTotal', 'Total staff'), countField('staffPresent', 'Present staff'),
      scoreField('punctualityScore', 'Punctuality'), scoreField('trainingCompletionScore', 'Training completion'),
      { name: 'absenceReason', label: 'Absence reason', type: 'text' }, notesField(),
    ],
  },
  { id: 'action', title: 'Operations action', group: 'Accountability', icon: Crosshair, tone: 'amber', fields: actionFields('operations') },
];

export const inventoryWorkflows: WorkflowDefinition[] = [
  { id: 'product', title: 'Add product', group: 'Catalog', icon: PackageCheck, tone: 'blue', endpoint: '/api/products', fields: productFields },
  {
    id: 'inventory-disposition', title: 'Stock disposition', group: 'Stock decisions', icon: PackageSearch, tone: 'coral',
    fields: [
      { name: 'reviewDate', label: 'Review date', type: 'date', required: true, defaultPreset: 'today' },
      { name: 'productId', label: 'Product', type: 'product', required: true, fullWidth: true },
      storeField(true),
      {
        name: 'action', label: 'Action', type: 'select', required: true, options: [
          option('markdown-20', 'Markdown 20%'), option('markdown-40', 'Markdown 40%'), option('markdown-60', 'Markdown 60%'),
          option('transfer', 'Transfer'), option('donate', 'Donate'), option('write-off', 'Write off'),
        ],
      },
      { name: 'justification', label: 'Justification', type: 'textarea', required: true, fullWidth: true },
    ],
  },
  { id: 'action', title: 'Inventory action', group: 'Stock decisions', icon: ClipboardCheck, tone: 'green', fields: actionFields('inventory') },
];

export const brandWorkflows: WorkflowDefinition[] = [
  {
    id: 'brand-health', title: 'Brand health assessment', group: 'Brand signals', icon: Activity, tone: 'green',
    fields: [
      todayField(),
      { name: 'brandId', label: 'Brand', type: 'select', reference: 'brands', required: true },
      { name: 'type', label: 'Assessment type', type: 'text', required: true },
      scoreField('awarenessScore', 'Awareness'), scoreField('considerationScore', 'Consideration'),
      scoreField('preferenceScore', 'Preference'), scoreField('satisfactionScore', 'Satisfaction'),
      scoreField('loyaltyScore', 'Loyalty'), scoreField('advocacyScore', 'Advocacy'),
      scoreField('momentumScore', 'Momentum'), scoreField('overallOverride', 'Overall override', false),
      { name: 'overrideReason', label: 'Override reason', type: 'textarea', fullWidth: true, showWhen: { field: 'overallOverride', truthy: true } },
    ],
  },
  {
    id: 'brand-sentiment', title: 'Sentiment snapshot', group: 'Brand signals', icon: MessageSquareText, tone: 'teal',
    fields: [
      todayField(),
      { name: 'brandId', label: 'Brand', type: 'select', reference: 'brands', required: true },
      { name: 'source', label: 'Source', type: 'text', required: true },
      countField('positiveMentions', 'Positive mentions'), countField('neutralMentions', 'Neutral mentions'), countField('negativeMentions', 'Negative mentions'),
      { name: 'positiveTheme', label: 'Positive theme', type: 'textarea', fullWidth: true },
      { name: 'negativeTheme', label: 'Negative theme', type: 'textarea', fullWidth: true },
    ],
  },
  {
    id: 'competitor', title: 'Competitor activity', group: 'Market', icon: Crosshair, tone: 'coral',
    fields: [
      todayField(),
      { name: 'competitor', label: 'Competitor', type: 'text', required: true },
      { name: 'brandId', label: 'Affected brand', type: 'select', reference: 'brands' },
      { name: 'shareOfVoice', label: 'Share of voice', type: 'number', min: 0, max: 100, step: 0.1 },
      { name: 'activityType', label: 'Activity type', type: 'text' },
      { name: 'threatLevel', label: 'Threat level', type: 'select', required: true, defaultValue: 'medium', options: [option('low', 'Low'), option('medium', 'Medium'), option('high', 'High'), option('critical', 'Critical')] },
      { name: 'description', label: 'Activity', type: 'textarea', required: true, fullWidth: true },
      notesField('recommendedResponse', 'Recommended response'),
    ],
  },
  {
    id: 'digital-reputation', title: 'Digital reputation', group: 'Market', icon: CircleGauge, tone: 'blue',
    fields: [
      todayField(),
      { name: 'brandId', label: 'Brand', type: 'select', reference: 'brands' },
      { name: 'googleRating', label: 'Google rating', type: 'number', min: 0, max: 5, step: 0.1 },
      countField('googleReviewCount', 'Google reviews'),
      { name: 'instagramSentiment', label: 'Instagram sentiment', type: 'number', min: 0, max: 100, step: 0.1 },
      countField('instagramFollowers', 'Instagram followers'),
      { name: 'responseRate', label: 'Response rate', type: 'number', min: 0, max: 100, step: 0.1 },
      { name: 'averageResponseHours', label: 'Average response hours', type: 'number', min: 0, step: 0.1 },
      { name: 'nps', label: 'NPS', type: 'number', min: -100, max: 100, step: 1 },
      { name: 'trustpilotRating', label: 'Trustpilot rating', type: 'number', min: 0, max: 5, step: 0.1 },
      countField('newReviews', 'New reviews'), countField('negativeReviews', 'Negative reviews'),
    ],
  },
  { id: 'feedback', title: 'Customer feedback', group: 'Customer voice', icon: HeartHandshake, tone: 'amber', fields: feedbackFields },
  { id: 'action', title: 'Brand action', group: 'Accountability', icon: ClipboardCheck, tone: 'orchid', fields: actionFields('brand') },
];

export const storeWorkflows: WorkflowDefinition[] = [
  {
    id: 'customer-capture', title: 'Customer capture', group: 'Customers', icon: ContactRound, tone: 'teal',
    fields: [
      todayField(), storeField(false),
      { name: 'name', label: 'Customer name', type: 'text', required: true },
      { name: 'phone', label: 'Phone number', type: 'text', required: true, placeholder: '024 000 0000' },
      { name: 'lifecycle', label: 'Customer stage', type: 'select', required: true, defaultValue: 'lead', options: [option('lead', 'Lead'), option('buyer', 'Buyer')] },
      { name: 'source', label: 'Source', type: 'text', required: true, placeholder: 'Walk-in, referral, Instagram' },
      { name: 'sourceDetail', label: 'Source detail', type: 'text' },
      { name: 'occupation', label: 'Occupation', type: 'text' },
      { name: 'sizePreference', label: 'Size preference', type: 'text' },
      { name: 'productId', label: 'Product interest', type: 'product', fullWidth: true },
      { name: 'interestText', label: 'Other interest', type: 'textarea', fullWidth: true },
      { name: 'fulfillmentStatus', label: 'Could not fulfill?', type: 'select', options: [option('in_stock', 'In stock'), option('stock_gap', 'Stock gap')] },
      { name: 'stockGapQuantity', label: 'Quantity wanted', type: 'number', min: 1, step: 1, showWhen: { field: 'fulfillmentStatus', equals: 'stock_gap' } },
      { name: 'stockGapValue', label: 'Estimated missed value', type: 'money', min: 0, step: 0.01, showWhen: { field: 'fulfillmentStatus', equals: 'stock_gap' } },
      { name: 'stockGapCause', label: 'Reason for stock gap', type: 'select', showWhen: { field: 'fulfillmentStatus', equals: 'stock_gap' }, options: [option('size_unavailable', 'Size unavailable'), option('colour_unavailable', 'Colour unavailable'), option('price', 'Price'), option('authenticity_doubt', 'Authenticity concern'), option('discount_declined', 'Discount declined'), option('other', 'Other')] },
      notesField(),
    ],
  },
];

export const targetWorkflows: WorkflowDefinition[] = [
  { id: 'target', title: 'Set performance target', group: 'Targets', icon: Target, tone: 'green', fields: targetFields },
];

export const financeShortcuts: WorkflowShortcut[] = [
  { href: '/forms/finance/daily-reports', title: 'Daily report review', group: 'Daily finance', icon: ClipboardCheck, tone: 'amber' },
  { href: '/forms/finance/import', title: 'Import workbook', group: 'Finance data', icon: FileSpreadsheet, tone: 'teal' },
];

export const inventoryShortcuts: WorkflowShortcut[] = [
  { href: '/forms/inventory/goods-receipt', title: 'Goods receipt', group: 'Inventory documents', icon: PackageCheck, tone: 'green' },
  { href: '/forms/inventory/stock-transfer', title: 'Stock transfer', group: 'Inventory documents', icon: ArrowRightLeft, tone: 'blue' },
  { href: '/forms/inventory/stock-count', title: 'Stock count', group: 'Inventory documents', icon: ScanLine, tone: 'amber' },
  { href: '/forms/inventory/replenishment', title: 'Replenishment request', group: 'Inventory documents', icon: RefreshCcw, tone: 'teal' },
  { href: '/forms/inventory/catalog-import', title: 'Product catalogue import', group: 'Catalogue', icon: FileSpreadsheet, tone: 'blue' },
];

export const storeShortcuts: WorkflowShortcut[] = [
  { href: '/forms/store-manager/daily-report', title: 'Daily store report', group: 'Trading', icon: ReceiptText, tone: 'green' },
  { href: '/forms/store-manager/stock-transfer', title: 'Stock transfer request', group: 'Inventory', icon: ArrowRightLeft, tone: 'blue' },
  { href: '/forms/store-manager/weekly-review', title: 'Weekly review', group: 'Trading', icon: CalendarRange, tone: 'orchid' },
];
