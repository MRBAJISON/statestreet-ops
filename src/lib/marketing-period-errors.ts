import { HttpError } from './server-errors';

/** Do not leak database SQL/parameters through workflow errors. */
export function rethrowMarketingPeriodError(error: unknown): never {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const detail = current as { code?: string; cause?: unknown };
    if (detail.code === '23P01' || detail.code === '23505') {
      throw new HttpError(409, 'These dates overlap an existing summary for the same campaign/channel/activity and brand/store. Choose a non-overlapping range. Social and clienteling corrections must use the original exact dates and scope.');
    }
    current = detail.cause;
  }
  throw error;
}
