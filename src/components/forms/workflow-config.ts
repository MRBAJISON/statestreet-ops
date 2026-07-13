import type { LucideIcon } from 'lucide-react';
import type { WorkflowName } from '@/lib/contracts/workflows';

export type WorkflowFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'date'
  | 'datetime'
  | 'select'
  | 'switch'
  | 'score'
  | 'product';

export type ReferenceSource =
  | 'stores'
  | 'brands'
  | 'categories'
  | 'paymentMethods'
  | 'expenseCategories'
  | 'suppliers'
  | 'cashAccounts'
  | 'users';

export interface WorkflowOption {
  value: string;
  label: string;
}

export interface FieldCondition {
  field: string;
  equals?: string;
  truthy?: boolean;
}

export interface WorkflowFieldDefinition {
  name: string;
  label: string;
  type: WorkflowFieldType;
  required?: boolean;
  reference?: ReferenceSource;
  options?: WorkflowOption[];
  placeholder?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  defaultValue?: string | boolean;
  defaultPreset?: 'today' | 'now' | 'year' | 'month-start' | 'month-end' | 'retention-end';
  minDatePreset?: 'today';
  maxDatePreset?: 'retention-end';
  showWhen?: FieldCondition;
  fullWidth?: boolean;
  hidden?: boolean;
}

export interface WorkflowDefinition {
  id: WorkflowName | 'product';
  title: string;
  group: string;
  icon: LucideIcon;
  tone: 'blue' | 'green' | 'amber' | 'coral' | 'teal' | 'orchid';
  fields: WorkflowFieldDefinition[];
  endpoint?: string;
  submitLabel?: string;
  successMessage?: string;
}

export interface WorkflowShortcut {
  href: string;
  title: string;
  group: string;
  icon: LucideIcon;
  tone: WorkflowDefinition['tone'];
}

export const option = (value: string, label: string): WorkflowOption => ({ value, label });

export const todayField = (name = 'businessDate', label = 'Business date'): WorkflowFieldDefinition => ({
  name,
  label,
  type: 'date',
  required: true,
  defaultPreset: 'today',
});

export const storeField = (required = false): WorkflowFieldDefinition => ({
  name: 'storeId',
  label: 'Store',
  type: 'select',
  reference: 'stores',
  required,
});

export const actionFields = (department: string): WorkflowFieldDefinition[] => [
  { name: 'department', label: 'Department', type: 'text', defaultValue: department, hidden: true },
  { name: 'title', label: 'Action', type: 'text', required: true, fullWidth: true, maxLength: 240 },
  { name: 'detail', label: 'Details', type: 'textarea', fullWidth: true, maxLength: 2000 },
  {
    name: 'priority',
    label: 'Priority',
    type: 'select',
    required: true,
    defaultValue: 'medium',
    options: [option('low', 'Low'), option('medium', 'Medium'), option('high', 'High'), option('critical', 'Critical')],
  },
  { name: 'dueDate', label: 'Due date', type: 'date' },
  { name: 'ownerUserId', label: 'Owner', type: 'select', reference: 'users' },
  { name: 'ownerName', label: 'External owner', type: 'text', placeholder: 'Only when the owner is not a user' },
  { name: 'storeId', label: 'Store', type: 'select', reference: 'stores' },
  { name: 'brandId', label: 'Brand', type: 'select', reference: 'brands' },
  { name: 'categoryId', label: 'Category', type: 'select', reference: 'categories' },
];
