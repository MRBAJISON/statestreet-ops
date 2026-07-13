'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type {
  InventoryDocumentLineRecord,
  InventoryDocumentName,
  InventoryDocumentRecord,
  InventoryDocumentResponse,
  InventoryDocumentsResponse,
} from '@/lib/contracts/documents';
import type { ReferenceDataResponse } from '@/lib/contracts/reference-data';
import { cn } from '@/lib/utils';
import { ProductCombobox } from './ProductCombobox';

interface DocumentLine {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  condition: 'good' | 'damaged' | 'partial';
  discrepancy: string;
  physicalQuantity: string;
  reorderQuantity: string;
  urgency: 'low' | 'normal' | 'high' | 'critical';
}

interface HeaderValues {
  businessDate: string;
  fromStoreId: string;
  toStoreId: string;
  reason: string;
  notes: string;
  poNumber: string;
  supplierId: string;
  receivingStoreId: string;
  storeId: string;
}

const DOCUMENT_LABELS: Record<InventoryDocumentName, string> = {
  'stock-transfer': 'Stock transfer',
  'goods-receipt': 'Goods receipt',
  'stock-count': 'Stock count',
  replenishment: 'Replenishment request',
};

const DOCUMENT_PLURAL_LABELS: Record<InventoryDocumentName, string> = {
  'stock-transfer': 'stock transfers',
  'goods-receipt': 'goods receipts',
  'stock-count': 'stock counts',
  replenishment: 'replenishment requests',
};

const businessDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

let nextLineKey = 1;

function emptyLine(): DocumentLine {
  return {
    key: nextLineKey++,
    productId: '',
    quantity: '',
    unitCost: '',
    condition: 'good',
    discrepancy: '',
    physicalQuantity: '',
    reorderQuantity: '',
    urgency: 'normal',
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function responseError(response: Response, fallback = 'The inventory document could not be saved') {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

function formatBusinessDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : businessDateFormatter.format(date);
}

function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function documentQuantity(record: InventoryDocumentRecord) {
  return record.totalQuantity;
}

function documentLineCount(record: InventoryDocumentRecord) {
  return record.lineCount;
}

function documentContext(document: InventoryDocumentName, record: InventoryDocumentRecord) {
  if (document === 'stock-transfer') {
    if (record.fromStoreName && record.toStoreName) return `${record.fromStoreName} to ${record.toStoreName}`;
    return record.fromStoreName ?? record.toStoreName ?? 'Store transfer';
  }
  if (document === 'goods-receipt') {
    return (
      [record.receivingStoreName, record.supplierName ? `Supplier: ${record.supplierName}` : null]
        .filter(Boolean)
        .join(' / ') || 'Goods receipt'
    );
  }
  if (document === 'stock-count') return record.storeName ?? 'Store stock count';
  return (
    [record.storeName, record.supplierName ? `Supplier: ${record.supplierName}` : null].filter(Boolean).join(' / ') ||
    'Replenishment request'
  );
}

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: string | null | undefined, currency: string) {
  const amount = numberValue(value);
  if (amount === null) return '-';
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
  }
}

function DocumentStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const variant = ['cancelled', 'rejected'].includes(normalized)
    ? 'destructive'
    : ['received', 'approved', 'fulfilled'].includes(normalized)
      ? 'default'
      : ['authorized', 'in-transit', 'ordered'].includes(normalized)
        ? 'secondary'
        : 'outline';
  return (
    <Badge variant={variant} className="capitalize">
      {normalized.replaceAll('-', ' ')}
    </Badge>
  );
}

function DocumentSummary({ document, record }: { document: InventoryDocumentName; record: InventoryDocumentRecord }) {
  const count = documentLineCount(record);
  const quantity = documentQuantity(record);

  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1fr)_8.5rem_10rem]">
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">#{record.id}</span>
          <DocumentStatusBadge status={record.status} />
        </div>
        <p className="mt-1 break-words text-sm text-muted-foreground">{documentContext(document, record)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Date</p>
        <p className="mt-1 text-sm font-medium">{formatBusinessDate(record.businessDate)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Products</p>
        <p className="mt-1 text-sm font-medium">
          {count.toLocaleString()} {count === 1 ? 'line' : 'lines'}
          {quantity === null ? null : ` / ${quantity.toLocaleString()} units`}
        </p>
      </div>
    </div>
  );
}

function RecentDocumentsSection({
  document,
  documents,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  document: InventoryDocumentName;
  documents: InventoryDocumentRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (record: InventoryDocumentRecord) => void;
}) {
  return (
    <section aria-labelledby="recent-documents-title" className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <h2 id="recent-documents-title" className="text-base font-semibold">
          Recent {DOCUMENT_PLURAL_LABELS[document]}
        </h2>
        {error ? null : (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Refresh recent documents"
            title="Refresh recent documents"
            disabled={loading}
            onClick={onRetry}
          >
            <RefreshCw className={cn(loading && 'animate-spin')} />
          </Button>
        )}
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Recent documents unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Retry loading recent documents"
              title="Retry"
              onClick={onRetry}
            >
              <RefreshCw />
            </Button>
          </AlertAction>
        </Alert>
      ) : loading ? (
        <div className="overflow-hidden rounded-md border bg-card">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className={cn(
                'grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_8.5rem_10rem]',
                index > 0 && 'border-t',
              )}
            >
              <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-48 max-w-full" />
              </div>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Empty className="rounded-md border bg-card py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No recent {DOCUMENT_PLURAL_LABELS[document]}</EmptyTitle>
            <EmptyDescription>No documents of this type have been recorded yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-md border bg-card shadow-sm">
          {documents.map((record, index) => {
            return (
              <div key={record.id} className={cn(index > 0 && 'border-t')}>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-20 w-full justify-start rounded-none border-0 px-4 py-3 text-left whitespace-normal"
                  aria-label={`View ${DOCUMENT_LABELS[document].toLowerCase()} ${record.id}`}
                  onClick={() => onSelect(record)}
                >
                  <DocumentSummary document={document} record={record} />
                  <ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DocumentDetailSheet({
  document,
  record,
  currency,
  loading,
  error,
  onRetry,
  onOpenChange,
}: {
  document: InventoryDocumentName;
  record: InventoryDocumentRecord | null;
  currency: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const lines = record?.lines ?? [];
  const totalQuantity = record ? documentQuantity(record) : null;

  function metricsForLine(line: InventoryDocumentLineRecord) {
    if (document === 'goods-receipt') {
      return [
        ['Quantity', line.quantity?.toLocaleString() ?? '-'],
        ['Unit cost', formatMoney(line.unitCost, currency)],
        ['Condition', line.condition ? titleCase(line.condition) : '-'],
      ];
    }
    if (document === 'stock-count') {
      const system = numberValue(line.systemQuantity);
      const physical = numberValue(line.physicalQuantity);
      return [
        ['System', system?.toLocaleString() ?? '-'],
        ['Physical', physical?.toLocaleString() ?? '-'],
        ['Variance', system === null || physical === null ? '-' : (physical - system).toLocaleString()],
      ];
    }
    if (document === 'replenishment') {
      return [
        ['In stock', line.currentStock?.toLocaleString() ?? '-'],
        ['Requested', line.reorderQuantity?.toLocaleString() ?? '-'],
        ['Urgency', line.urgency ? titleCase(line.urgency) : '-'],
      ];
    }
    return [['Quantity', line.quantity?.toLocaleString() ?? '-']];
  }

  return (
    <Sheet open={Boolean(record)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-xl">
        {record ? (
          <>
            <SheetHeader className="border-b px-5 py-5 pr-12 text-left">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SheetTitle>
                  {DOCUMENT_LABELS[document]} #{record.id}
                </SheetTitle>
                <DocumentStatusBadge status={record.status} />
              </div>
              <SheetDescription className="flex flex-wrap gap-x-2 gap-y-1">
                <span>{formatBusinessDate(record.businessDate)}</span>
                <span aria-hidden="true">/</span>
                <span>{documentContext(document, record)}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Products</dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {documentLineCount(record).toLocaleString()} {documentLineCount(record) === 1 ? 'line' : 'lines'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Quantity</dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {totalQuantity === null ? 'Not available' : `${totalQuantity.toLocaleString()} units`}
                  </dd>
                </div>
                {record.poNumber ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">PO number</dt>
                    <dd className="mt-1 break-words text-sm font-semibold">{record.poNumber}</dd>
                  </div>
                ) : null}
              </dl>

              {record.reason ? (
                <section className="mt-6">
                  <h3 className="text-sm font-semibold">Reason</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{record.reason}</p>
                </section>
              ) : null}

              {record.notes ? (
                <section className="mt-6">
                  <h3 className="text-sm font-semibold">Notes</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{record.notes}</p>
                </section>
              ) : null}

              <section className="mt-6">
                <h3 className="mb-3 text-sm font-semibold">Product lines</h3>
                {loading ? (
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : error ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Document details unavailable</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                    <AlertAction>
                      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                        <RefreshCw data-icon="inline-start" />
                        Retry
                      </Button>
                    </AlertAction>
                  </Alert>
                ) : lines.length ? (
                  <div className="divide-y overflow-hidden rounded-md border bg-card">
                    {lines.map((line) => {
                      return (
                        <article key={line.id} className="flex flex-col gap-3 p-4">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium">{line.productName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{line.productSku}</p>
                          </div>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                            {metricsForLine(line).map(([label, value]) => (
                              <div key={label}>
                                <dt className="text-xs text-muted-foreground">{label}</dt>
                                <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
                              </div>
                            ))}
                          </dl>
                          {line.discrepancy ? (
                            <p className="text-sm leading-6 text-muted-foreground">{line.discrepancy}</p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No product lines were returned for this document.</p>
                )}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function StoreSelect({
  id,
  value,
  onChange,
  references,
  exclude,
  allowedIds,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  references: ReferenceDataResponse;
  exclude?: string;
  allowedIds?: ReadonlySet<number>;
  disabled: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Select store" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {references.stores
            .filter(
              (store) =>
                store.type === 'store' &&
                String(store.id) !== exclude &&
                (!allowedIds || allowedIds.has(store.id))
            )
            .map((store) => (
              <SelectItem key={store.id} value={String(store.id)}>
                {store.name}
              </SelectItem>
            ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function InventoryDocumentForm({ document, backHref }: { document: InventoryDocumentName; backHref: string }) {
  const router = useRouter();
  const [references, setReferences] = useState<ReferenceDataResponse | null>(null);
  const [header, setHeader] = useState<HeaderValues>({
    businessDate: today(),
    fromStoreId: '',
    toStoreId: '',
    reason: '',
    notes: '',
    poNumber: '',
    supplierId: '',
    receivingStoreId: '',
    storeId: '',
  });
  const [lines, setLines] = useState<DocumentLine[]>(() => [emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<InventoryDocumentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<InventoryDocumentRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reference-data', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<ReferenceDataResponse>;
      })
      .then((data) => {
        setReferences(data);
        if (data.assignedStore) {
          setHeader((current) => ({
            ...current,
            fromStoreId: String(data.assignedStore!.id),
            storeId: String(data.assignedStore!.id),
          }));
        }
      })
      .catch((loadError: Error) => {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      });
    return () => controller.abort();
  }, []);

  const loadDocuments = useCallback(
    async (signal?: AbortSignal) => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetch(`/api/inventory-documents/${document}`, {
          signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(await responseError(response, 'Recent documents could not be loaded'));
        }
        const payload = (await response.json()) as InventoryDocumentsResponse;
        if (!Array.isArray(payload.documents)) {
          throw new Error('Recent documents returned an invalid response');
        }
        if (!signal?.aborted) setDocuments(payload.documents);
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError' && !signal?.aborted) {
          setHistoryError((loadError as Error).message);
        }
      } finally {
        if (!signal?.aborted) setHistoryLoading(false);
      }
    },
    [document],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadDocuments(controller.signal);
    return () => controller.abort();
  }, [loadDocuments]);

  useEffect(() => () => detailController.current?.abort(), []);

  async function loadDocument(record: InventoryDocumentRecord) {
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    setSelectedDocument(record);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/inventory-documents/${document}/${record.id}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(await responseError(response, 'Document details could not be loaded'));
      const payload = (await response.json()) as InventoryDocumentResponse;
      if (
        !payload.document ||
        payload.document.id !== record.id ||
        !Array.isArray(payload.document.lines)
      ) {
        throw new Error('Document details returned an invalid response');
      }
      if (!controller.signal.aborted) setSelectedDocument(payload.document);
    } catch (loadError) {
      if ((loadError as Error).name !== 'AbortError' && !controller.signal.aborted) {
        setDetailError((loadError as Error).message);
      }
    } finally {
      if (!controller.signal.aborted && detailController.current === controller) setDetailLoading(false);
    }
  }

  function closeDocumentDetail() {
    detailController.current?.abort();
    detailController.current = null;
    setSelectedDocument(null);
    setDetailLoading(false);
    setDetailError(null);
  }

  function updateHeader(name: keyof HeaderValues, value: string) {
    setHeader((current) => ({ ...current, [name]: value }));
  }

  function updateLine(key: number, name: keyof DocumentLine, value: string) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, [name]: value } : line)));
  }

  function buildPayload() {
    const common = { businessDate: header.businessDate, notes: header.notes || undefined };
    if (document === 'stock-transfer') {
      return {
        ...common,
        fromStoreId: references?.assignedStore ? undefined : Number(header.fromStoreId),
        toStoreId: Number(header.toStoreId),
        reason: header.reason,
        lines: lines.map((line) => ({ productId: Number(line.productId), quantity: Number(line.quantity) })),
      };
    }
    if (document === 'goods-receipt') {
      return {
        ...common,
        poNumber: header.poNumber || undefined,
        supplierId: Number(header.supplierId),
        receivingStoreId: Number(header.receivingStoreId),
        lines: lines.map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          unitCost: line.unitCost || undefined,
          condition: line.condition,
          discrepancy: line.discrepancy || undefined,
        })),
      };
    }
    if (document === 'stock-count') {
      return {
        ...common,
        storeId: Number(header.storeId),
        lines: lines.map((line) => ({
          productId: Number(line.productId),
          physicalQuantity: Number(line.physicalQuantity),
        })),
      };
    }
    return {
      ...common,
      storeId: references?.assignedStore ? undefined : Number(header.storeId),
      supplierId: header.supplierId ? Number(header.supplierId) : undefined,
      lines: lines.map((line) => ({
        productId: Number(line.productId),
        reorderQuantity: Number(line.reorderQuantity),
        urgency: line.urgency,
      })),
    };
  }

  function validate() {
    if (!header.businessDate) return 'Business date is required';
    if (lines.some((line) => !line.productId)) return 'Choose a product for every line';
    if (new Set(lines.map((line) => line.productId)).size !== lines.length) return 'Each product can appear only once';
    if (document === 'stock-transfer') {
      if ((!references?.assignedStore && !header.fromStoreId) || !header.toStoreId || !header.reason.trim())
        return 'Source, destination, and reason are required';
      if (lines.some((line) => !line.quantity || Number(line.quantity) <= 0))
        return 'Every transfer quantity must be greater than zero';
    }
    if (document === 'goods-receipt') {
      if (!header.supplierId || !header.receivingStoreId) return 'Supplier and receiving store are required';
      if (lines.some((line) => !line.quantity || Number(line.quantity) <= 0))
        return 'Every received quantity must be greater than zero';
    }
    if (document === 'stock-count') {
      if (!header.storeId) return 'Store is required';
      if (lines.some((line) => line.physicalQuantity === '' || Number(line.physicalQuantity) < 0))
        return 'Enter a physical quantity for every product';
    }
    if (document === 'replenishment') {
      if (!references?.assignedStore && !header.storeId) return 'Store is required';
      if (lines.some((line) => !line.reorderQuantity || Number(line.reorderQuantity) <= 0))
        return 'Every reorder quantity must be greater than zero';
    }
    return null;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/inventory-documents/${document}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success(`${DOCUMENT_LABELS[document]} saved`);
      router.push(backHref);
      router.refresh();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!references) {
    return (
      <div className="page-shell flex flex-col gap-5">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const assignedStore = references.assignedStore;
  const assignedStoreBrandIds = new Set(
    references.brandStores
      .filter((mapping) => mapping.storeId === assignedStore?.id)
      .map((mapping) => mapping.brandId)
  );
  const managerDestinationIds = assignedStore
    ? new Set(
        references.brandStores
          .filter((mapping) => assignedStoreBrandIds.has(mapping.brandId))
          .map((mapping) => mapping.storeId)
      )
    : undefined;
  const selectedDestinationId = Number(header.toStoreId);
  const selectedDestinationBrandIds = new Set(
    references.brandStores
      .filter((mapping) => mapping.storeId === selectedDestinationId)
      .map((mapping) => mapping.brandId)
  );
  const managerProductBrandIds = assignedStore
    ? document === 'stock-transfer'
      ? [...assignedStoreBrandIds].filter((brandId) => selectedDestinationBrandIds.has(brandId))
      : document === 'replenishment'
        ? [...assignedStoreBrandIds]
        : undefined
    : undefined;
  const lineGrid =
    document === 'goods-receipt'
      ? 'lg:grid-cols-[minmax(220px,1.4fr)_100px_120px_130px_minmax(180px,1fr)_36px]'
      : document === 'stock-transfer'
        ? 'lg:grid-cols-[minmax(240px,1fr)_140px_36px]'
        : document === 'stock-count'
          ? 'lg:grid-cols-[minmax(240px,1fr)_170px_36px]'
          : 'lg:grid-cols-[minmax(240px,1fr)_150px_150px_36px]';

  return (
    <div className="page-shell flex flex-col gap-10">
      <form onSubmit={submit} className="flex flex-col gap-7">
        <header className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="icon" asChild aria-label="Back to workflows">
            <Link href={backHref}>
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-8">{DOCUMENT_LABELS[document]}</h1>
            {assignedStore ? <p className="text-sm text-muted-foreground">{assignedStore.name}</p> : null}
          </div>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Check this document</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="border-y bg-card px-4 py-5 sm:px-5">
          <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="business-date">Business date</FieldLabel>
              <Input
                id="business-date"
                type="date"
                value={header.businessDate}
                disabled={saving}
                onChange={(event) => updateHeader('businessDate', event.target.value)}
              />
            </Field>

            {document === 'stock-transfer' ? (
              <>
                {!assignedStore ? (
                  <Field>
                    <FieldLabel htmlFor="from-store">Source store</FieldLabel>
                    <StoreSelect
                      id="from-store"
                      value={header.fromStoreId}
                      onChange={(value) => updateHeader('fromStoreId', value)}
                      references={references}
                      exclude={header.toStoreId}
                      disabled={saving}
                    />
                  </Field>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="to-store">Destination store</FieldLabel>
                  <StoreSelect
                    id="to-store"
                    value={header.toStoreId}
                    onChange={(value) => updateHeader('toStoreId', value)}
                    references={references}
                    exclude={header.fromStoreId}
                    allowedIds={managerDestinationIds}
                    disabled={saving}
                  />
                </Field>
                <Field className="lg:col-span-2">
                  <FieldLabel htmlFor="reason">Reason</FieldLabel>
                  <Input
                    id="reason"
                    value={header.reason}
                    disabled={saving}
                    onChange={(event) => updateHeader('reason', event.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {document === 'goods-receipt' ? (
              <>
                <Field>
                  <FieldLabel htmlFor="supplier">Supplier</FieldLabel>
                  <Select
                    value={header.supplierId}
                    onValueChange={(value) => updateHeader('supplierId', value)}
                    disabled={saving}
                  >
                    <SelectTrigger id="supplier" className="w-full">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {references.suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={String(supplier.id)}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="receiving-store">Receiving store</FieldLabel>
                  <StoreSelect
                    id="receiving-store"
                    value={header.receivingStoreId}
                    onChange={(value) => updateHeader('receivingStoreId', value)}
                    references={references}
                    disabled={saving}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="po-number">PO number</FieldLabel>
                  <Input
                    id="po-number"
                    value={header.poNumber}
                    disabled={saving}
                    onChange={(event) => updateHeader('poNumber', event.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {(document === 'stock-count' || document === 'replenishment') && !assignedStore ? (
              <Field>
                <FieldLabel htmlFor="document-store">Store</FieldLabel>
                <StoreSelect
                  id="document-store"
                  value={header.storeId}
                  onChange={(value) => updateHeader('storeId', value)}
                  references={references}
                  disabled={saving}
                />
              </Field>
            ) : null}

            {document === 'replenishment' ? (
              <Field>
                <FieldLabel htmlFor="replenishment-supplier">Preferred supplier</FieldLabel>
                <Select
                  value={header.supplierId}
                  onValueChange={(value) => updateHeader('supplierId', value)}
                  disabled={saving}
                >
                  <SelectTrigger id="replenishment-supplier" className="w-full">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {references.suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={String(supplier.id)}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </FieldGroup>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Products</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((current) => [...current, emptyLine()])}
              disabled={saving}
            >
              <Plus data-icon="inline-start" />
              Add product
            </Button>
          </div>

          <div className="overflow-hidden rounded-md border bg-card shadow-sm">
            {lines.map((line, index) => (
              <div
                key={line.key}
                className={cn('grid grid-cols-1 items-end gap-4 p-4', lineGrid, index > 0 && 'border-t')}
              >
                <Field>
                  <FieldLabel className={cn(index > 0 && 'lg:sr-only')}>Product</FieldLabel>
                  <ProductCombobox
                    value={line.productId}
                    disabled={saving || managerProductBrandIds?.length === 0}
                    allowedBrandIds={managerProductBrandIds}
                    onChange={(value) => updateLine(line.key, 'productId', value)}
                  />
                </Field>

                {document === 'stock-transfer' || document === 'goods-receipt' ? (
                  <Field>
                    <FieldLabel className={cn(index > 0 && 'lg:sr-only')}>Quantity</FieldLabel>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity}
                      disabled={saving}
                      onChange={(event) => updateLine(line.key, 'quantity', event.target.value)}
                    />
                  </Field>
                ) : null}

                {document === 'goods-receipt' ? (
                  <>
                    <Field>
                      <FieldLabel className={cn(index > 0 && 'lg:sr-only')}>Unit cost</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unitCost}
                        disabled={saving}
                        onChange={(event) => updateLine(line.key, 'unitCost', event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel className={cn(index > 0 && 'lg:sr-only')}>Condition</FieldLabel>
                      <Select
                        value={line.condition}
                        onValueChange={(value) => updateLine(line.key, 'condition', value)}
                        disabled={saving}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel className={cn(index > 0 && 'lg:sr-only')}>Discrepancy</FieldLabel>
                      <Input
                        value={line.discrepancy}
                        disabled={saving}
                        onChange={(event) => updateLine(line.key, 'discrepancy', event.target.value)}
                      />
                    </Field>
                  </>
                ) : null}

                {document === 'stock-count' ? (
                  <Field>
                    <FieldLabel className={cn(index > 0 && 'lg:sr-only')}>Physical quantity</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={line.physicalQuantity}
                      disabled={saving}
                      onChange={(event) => updateLine(line.key, 'physicalQuantity', event.target.value)}
                    />
                  </Field>
                ) : null}

                {document === 'replenishment' ? (
                  <>
                    <Field>
                      <FieldLabel className={cn(index > 0 && 'lg:sr-only')}>Reorder quantity</FieldLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={line.reorderQuantity}
                        disabled={saving}
                        onChange={(event) => updateLine(line.key, 'reorderQuantity', event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel className={cn(index > 0 && 'lg:sr-only')}>Urgency</FieldLabel>
                      <Select
                        value={line.urgency}
                        onValueChange={(value) => updateLine(line.key, 'urgency', value)}
                        disabled={saving}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove product"
                  disabled={saving || lines.length === 1}
                  onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <Field>
          <FieldLabel htmlFor="document-notes">Notes</FieldLabel>
          <Textarea
            id="document-notes"
            value={header.notes}
            disabled={saving}
            onChange={(event) => updateHeader('notes', event.target.value)}
          />
        </Field>

        <footer className="flex flex-wrap justify-end gap-3 border-t pt-5">
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
            Save document
          </Button>
        </footer>
      </form>

      <RecentDocumentsSection
        document={document}
        documents={documents}
        loading={historyLoading}
        error={historyError}
        onRetry={() => void loadDocuments()}
        onSelect={(record) => void loadDocument(record)}
      />

      <DocumentDetailSheet
        document={document}
        record={selectedDocument}
        currency={references.organization.currency}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          if (selectedDocument) void loadDocument(selectedDocument);
        }}
        onOpenChange={(open) => {
          if (!open) closeDocumentDetail();
        }}
      />
    </div>
  );
}
