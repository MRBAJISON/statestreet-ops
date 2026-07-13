export const CUSTOMER_CONTACT_RETENTION_DAYS = 90;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function customerContactRetentionWindow(now = new Date()) {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + CUSTOMER_CONTACT_RETENTION_DAYS);
  return { from: isoDate(now), to: isoDate(end) };
}
