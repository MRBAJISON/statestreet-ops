export const clean = (value) => String(value ?? '').trim();

export function validDate(value) {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

export function decimal(value) {
  const normalized = clean(value).replace(/[, ]/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function whole(value) {
  const parsed = decimal(value);
  return parsed === null || !Number.isInteger(parsed) ? null : parsed;
}

export function legacyStockValue(stockValue, unitValue, physicalQuantity) {
  if (clean(stockValue)) {
    const aggregate = decimal(stockValue);
    return aggregate === null ? null : aggregate.toFixed(2);
  }
  if (clean(unitValue)) {
    const unit = decimal(unitValue);
    return unit === null || physicalQuantity === null
      ? null
      : (unit * physicalQuantity).toFixed(2);
  }
  return '0.00';
}

export function score(value, fallback = 0) {
  if (clean(value) === '') return fallback;
  const parsed = decimal(value);
  return parsed !== null && parsed <= 100 ? Math.round(parsed) : null;
}

export function normalizePhone(value) {
  let digits = clean(value).replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = `233${digits.slice(1)}`;
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

export function firstCode(value) {
  if (Array.isArray(value)) return clean(value.find((item) => clean(item)));
  return clean(value).split(',').map(clean).find(Boolean) ?? '';
}

export function weekStart(weekEnd) {
  if (!validDate(weekEnd)) return null;
  const date = new Date(`${weekEnd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 6);
  return date.toISOString().slice(0, 10);
}

export function monthPeriod(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function productStatus(value) {
  const status = clean(value).toLowerCase();
  if (status === 'oos') return 'out-of-stock';
  return ['active', 'slow', 'dead', 'out-of-stock'].includes(status) ? status : 'active';
}

export function actionState(value) {
  const status = clean(value).toLowerCase().replace(/\s+/g, '-');
  if (status === 'on-track' || status === 'ahead') return { status: 'open', priority: 'low' };
  if (status === 'at-risk' || status === 'behind') return { status: 'in-progress', priority: 'high' };
  if (status === 'off-track') return { status: 'blocked', priority: 'high' };
  return { status: 'in-progress', priority: 'medium' };
}

export function maintenanceStatus(value) {
  const status = clean(value).toLowerCase();
  if (status === 'overdue') return 'blocked';
  if (status === 'resolved' || status === 'closed') return 'completed';
  return ['open', 'in-progress', 'blocked', 'completed', 'cancelled'].includes(status) ? status : 'open';
}

export function lifecycle(value) {
  return clean(value).toLowerCase().includes('buyer') ? 'buyer' : 'lead';
}
