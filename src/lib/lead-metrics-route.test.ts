import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { HttpError } from './server-errors';

const mock = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: mock.session }));
vi.mock('@/lib/lead-metrics', () => ({ listLeadMetrics: mock.list, updateLeadMetric: mock.update }));
import { GET, PUT } from '../app/api/lead-metrics/route';

beforeEach(() => { vi.clearAllMocks(); });
describe('lead summary endpoint', () => {
  it('requires authentication for history and corrections', async () => {
    mock.session.mockResolvedValue(null);
    expect((await GET(new NextRequest('http://localhost/api/lead-metrics'))).status).toBe(401);
    expect((await PUT(new NextRequest('http://localhost/api/lead-metrics?id=1', { method: 'PUT' }))).status).toBe(401);
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('validates identifiers and page numbers before database calls', async () => {
    mock.session.mockResolvedValue({ user: { role: 'marketing' } });
    expect((await GET(new NextRequest('http://localhost/api/lead-metrics?page=-1'))).status).toBe(400);
    expect((await PUT(new NextRequest('http://localhost/api/lead-metrics?id=0', { method: 'PUT' }))).status).toBe(400);
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('returns server authorization/conflict errors without exposing database details', async () => {
    mock.session.mockResolvedValue({ user: { role: 'owner' } });
    mock.list.mockRejectedValue(new HttpError(403, 'Not allowed'));
    expect((await GET(new NextRequest('http://localhost/api/lead-metrics'))).status).toBe(403);
    mock.update.mockRejectedValue(new HttpError(409, 'Reload summary'));
    const response = await PUT(new NextRequest('http://localhost/api/lead-metrics?id=1', { method: 'PUT', body: '{}' }));
    expect(response.status).toBe(409);
    mock.list.mockRejectedValue(new Error('Private database connection details'));
    const failed = await GET(new NextRequest('http://localhost/api/lead-metrics'));
    expect(await failed.json()).toEqual({ error: 'Summaries could not be loaded' });
  });
  it('disables caching for history responses', async () => {
    mock.session.mockResolvedValue({ user: { role: 'marketing' } });
    mock.list.mockResolvedValue({ records: [], page: 1, totalPages: 1 });
    expect((await GET(new NextRequest('http://localhost/api/lead-metrics'))).headers.get('cache-control')).toBe('private, no-store');
  });
});
