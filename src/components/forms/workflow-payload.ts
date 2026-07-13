import type { WorkflowDefinition, WorkflowFieldDefinition } from './workflow-config';

export type FormValue = string | boolean;
export type FormValues = Record<string, FormValue>;

export function workflowFieldIsVisible(field: WorkflowFieldDefinition, values: FormValues) {
  if (!field.showWhen) return true;
  const current = values[field.showWhen.field];
  if (field.showWhen.equals !== undefined) return current === field.showWhen.equals;
  if (field.showWhen.truthy) return Boolean(current);
  return true;
}

export function buildWorkflowPayload(
  definition: Pick<WorkflowDefinition, 'fields'>,
  values: FormValues
) {
  const payload: Record<string, unknown> = {};
  for (const field of definition.fields) {
    if (!workflowFieldIsVisible(field, values)) continue;
    const value = values[field.name];
    if (field.type === 'switch') {
      payload[field.name] = Boolean(value);
      continue;
    }
    if (value === '' || value === undefined) continue;
    if (field.type === 'money') {
      payload[field.name] = String(value);
      continue;
    }
    if (['number', 'score', 'product'].includes(field.type) || field.reference) {
      payload[field.name] = Number(value);
      continue;
    }
    if (field.type === 'datetime') {
      payload[field.name] = new Date(String(value)).toISOString();
      continue;
    }
    payload[field.name] = value;
  }
  return payload;
}
