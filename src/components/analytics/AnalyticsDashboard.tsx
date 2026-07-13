'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type {
  AnalyticsPreset,
  AnalyticsResponse,
  AnalyticsView,
  BrandDomain,
  CommercialDomain,
  ExecutiveDomain,
  FinanceDomain,
  InventoryDomain,
  MarketingDomain,
  OperationsDomain,
  StoreDomain,
  TradingOverview,
} from '@/lib/contracts/analytics';
import type { ReferenceDataResponse } from '@/lib/contracts/reference-data';
import { BrandOverview } from './BrandOverview';
import { CommercialOverview } from './CommercialOverview';
import { DashboardHeader } from './DashboardHeader';
import { DashboardSkeleton } from './DashboardPrimitives';
import { ExecutiveOverview } from './ExecutiveOverview';
import { FinanceOverview } from './FinanceOverview';
import { InventoryOverview } from './InventoryOverview';
import { MarketingOverview } from './MarketingOverview';
import { OperationsOverview } from './OperationsOverview';
import { StoreOverview } from './StoreOverview';
import { formatShortDate } from './format';

interface AnalyticsDashboardProps {
  view: AnalyticsView;
  title: string;
  description: string;
}

type DashboardResponse = AnalyticsResponse<
  | BrandDomain
  | CommercialDomain
  | ExecutiveDomain
  | FinanceDomain
  | InventoryDomain
  | MarketingDomain
  | OperationsDomain
  | StoreDomain
>;

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'The dashboard could not be loaded');
  return payload;
}

function DashboardContent({
  view,
  data,
  onRefresh,
  canDecideWeeklyReviews,
}: {
  view: AnalyticsView;
  data: DashboardResponse;
  onRefresh: () => void;
  canDecideWeeklyReviews: boolean;
}) {
  const trading = data.trading as TradingOverview | undefined;

  switch (view) {
    case 'executive':
      return <ExecutiveOverview meta={data.meta} trading={trading!} domain={data.domain as ExecutiveDomain} />;
    case 'finance':
      return <FinanceOverview meta={data.meta} trading={trading!} domain={data.domain as FinanceDomain} />;
    case 'commercial':
      return (
        <CommercialOverview
          meta={data.meta}
          trading={trading!}
          domain={data.domain as CommercialDomain}
          onRefresh={onRefresh}
          canDecideWeeklyReviews={canDecideWeeklyReviews}
        />
      );
    case 'marketing':
      return <MarketingOverview meta={data.meta} domain={data.domain as MarketingDomain} />;
    case 'operations':
      return <OperationsOverview meta={data.meta} trading={trading!} domain={data.domain as OperationsDomain} />;
    case 'inventory':
      return <InventoryOverview meta={data.meta} domain={data.domain as InventoryDomain} />;
    case 'brand':
      return <BrandOverview meta={data.meta} domain={data.domain as BrandDomain} />;
    case 'store':
      return <StoreOverview meta={data.meta} trading={trading!} domain={data.domain as StoreDomain} />;
  }
}

export function AnalyticsDashboard({ view, title, description }: AnalyticsDashboardProps) {
  const [preset, setPreset] = useState<AnalyticsPreset>('30d');
  const [storeId, setStoreId] = useState<number | null>(null);
  const [referenceData, setReferenceData] = useState<ReferenceDataResponse | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const hasLoaded = useRef(false);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/reference-data', { signal: controller.signal, cache: 'no-store' })
      .then(readJson<ReferenceDataResponse>)
      .then(setReferenceData)
      .catch((loadError: Error) => {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ preset });
    if (storeId) params.set('storeId', String(storeId));

    async function loadDashboard() {
      setRefreshing(hasLoaded.current);
      setError(null);

      try {
        const analytics = await fetch(`/api/analytics/${view}?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        }).then(readJson<DashboardResponse>);
        setData(analytics);
        hasLoaded.current = true;
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') setError((loadError as Error).message);
      } finally {
        if (!controller.signal.aborted) setRefreshing(false);
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [preset, refreshKey, storeId, view]);

  if (!data && !error) return <DashboardSkeleton />;

  const assignedStore = referenceData?.assignedStore ?? null;
  const retailStores = referenceData?.stores.filter((store) => store.type === 'store') ?? [];

  return (
    <div className="page-shell flex flex-col gap-5">
      <DashboardHeader
        title={title}
        description={data ? `${formatShortDate(data.meta.from)} to ${formatShortDate(data.meta.to)} · ${data.meta.store?.name ?? 'All stores'}` : description}
        preset={preset}
        onPresetChange={setPreset}
        stores={retailStores}
        storeId={assignedStore?.id ?? storeId}
        onStoreChange={setStoreId}
        storeLocked={Boolean(assignedStore)}
        onRefresh={refresh}
        refreshing={refreshing}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RotateCcw data-icon="inline-start" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <DashboardContent
          view={view}
          data={data}
          onRefresh={refresh}
          canDecideWeeklyReviews={referenceData?.capabilities.canDecideWeeklyReviews === true}
        />
      ) : null}
    </div>
  );
}
