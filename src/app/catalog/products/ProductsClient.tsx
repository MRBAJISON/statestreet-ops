'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  PackageSearch,
  Pencil,
  Plus,
  Save,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ReferenceDataResponse, ReferenceOption } from '@/lib/contracts/reference-data';

type ProductStatus = 'active' | 'all' | 'inactive';

interface ProductRow {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  brandId: number;
  brandName: string;
  categoryId: number;
  categoryName: string;
  sellingPrice: string | number | null;
  // Total held across every store; the form sets it for one store at a time.
  quantity?: number | null;
  active: boolean;
  updatedAt: string;
}

interface ProductDraft {
  sku: string;
  name: string;
  description: string;
  brandId: string;
  categoryId: string;
  sellingPrice: string;
  storeId: string;
  quantity: string;
  active: boolean;
}

interface ProductResponse {
  products: ProductRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const EMPTY_DRAFT: ProductDraft = {
  sku: '',
  name: '',
  description: '',
  brandId: '',
  categoryId: '',
  sellingPrice: '',
  storeId: '',
  quantity: '',
  active: true,
};

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? 'The request could not be completed';
}

function moneyValue(value: string) {
  return value.trim() === '' ? null : value.trim();
}

function categoriesForBrand(reference: ReferenceDataResponse | null, brandId: number) {
  if (!reference) return [];
  const mapped = reference.brandCategories.filter((item) => item.brandId === brandId).map((item) => item.categoryId);
  if (!mapped.length) return reference.categories;
  const allowed = new Set(mapped);
  return reference.categories.filter((category) => allowed.has(category.id));
}

export default function ProductsClient({ currency, canReadCost }: { currency: string; canReadCost: boolean }) {
  const [reference, setReference] = useState<ReferenceDataResponse | null>(null);
  const [referenceError, setReferenceError] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ProductStatus>('active');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/reference-data', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        setReference((await response.json()) as ReferenceDataResponse);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setReferenceError((error as Error).message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setLoadError('');
      try {
        const params = new URLSearchParams({ status, page: String(page), pageSize: '25' });
        if (query.trim()) params.set('q', query.trim());
        const response = await fetch(`/api/products?${params}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(await responseError(response));
        const payload = (await response.json()) as ProductResponse;
        setProducts(payload.products);
        setPagination(payload.pagination);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [page, query, reloadKey, status]);

  const availableCategories = useMemo(
    () => categoriesForBrand(reference, Number(draft.brandId)),
    [draft.brandId, reference]
  );
  const availableStores = useMemo(
    () => reference?.stores.filter((store) => store.type === 'store') ?? [],
    [reference]
  );

  function openNew() {
    if (!reference) return;
    const brand = reference.brands[0];
    const category = brand ? categoriesForBrand(reference, brand.id)[0] : reference.categories[0];
    setEditing(null);
    setDraft({
      ...EMPTY_DRAFT,
      brandId: brand ? String(brand.id) : '',
      categoryId: category ? String(category.id) : '',
    });
    setSaveError('');
    setSheetOpen(true);
  }

  function openEdit(product: ProductRow) {
    setEditing(product);
    setDraft({
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      brandId: String(product.brandId),
      categoryId: String(product.categoryId),
      sellingPrice: product.sellingPrice == null ? '' : String(product.sellingPrice),
      // Quantity is per store, so editing an existing product starts blank rather
      // than showing a group total someone might overwrite one store with.
      storeId: '',
      quantity: '',
      active: product.active,
    });
    setSaveError('');
    setSheetOpen(true);
  }

  function selectBrand(value: string) {
    const categories = categoriesForBrand(reference, Number(value));
    setDraft((current) => ({
      ...current,
      brandId: value,
      categoryId: categories[0] ? String(categories[0].id) : '',
    }));
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    const payload = {
      sku: draft.sku,
      name: draft.name,
      description: draft.description.trim() || null,
      brandId: Number(draft.brandId),
      categoryId: Number(draft.categoryId),
      sellingPrice: moneyValue(draft.sellingPrice),
      ...(draft.storeId && draft.quantity.trim() !== ''
        ? { storeId: Number(draft.storeId), quantity: Number(draft.quantity) }
        : {}),
    };
    try {
      const response = await fetch(editing ? `/api/products/${editing.id}` : '/api/products', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...payload, active: draft.active, expectedUpdatedAt: editing.updatedAt } : payload),
      });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success(editing ? 'Product updated' : 'Product created');
      setSheetOpen(false);
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const formatMoney = (value: string | number | null | undefined) =>
    value == null ? '—' : `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-chart-1/12 text-chart-1"><PackageSearch className="size-5" /></span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">Product catalog</h1>
                <Badge variant="secondary">{pagination.total}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Reusable product records for sales and inventory workflows</p>
            </div>
          </div>
          <Button size="lg" onClick={openNew} disabled={!reference || Boolean(referenceError)}><Plus /> New product</Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="Search name or SKU"
              className="h-9 pl-9"
            />
          </div>
          <ToggleGroup type="single" value={status} onValueChange={(value) => { if (value) { setStatus(value as ProductStatus); setPage(1); } }} variant="outline" spacing={0}>
            <ToggleGroupItem value="active">Active</ToggleGroupItem>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {referenceError || loadError ? (
          <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">{referenceError || loadError}</div>
        ) : null}

        <div className="surface overflow-hidden">
          {loading ? (
            <div className="flex flex-col gap-0 p-2">
              {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="my-1 h-12 w-full" />)}
            </div>
          ) : products.length ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/45 hover:bg-muted/45">
                  <TableHead className="pl-4">Product</TableHead>
                  <TableHead className="hidden md:table-cell">Brand</TableHead>
                  <TableHead className="hidden lg:table-cell">Category</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Retail price</TableHead>
                  <TableHead className="hidden text-right xl:table-cell">Quantity</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="max-w-[320px] pl-4">
                      <button type="button" className="block max-w-full text-left" onClick={() => openEdit(product)}>
                        <span className="block truncate font-medium">{product.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{product.sku}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground sm:hidden">{product.brandName} · {product.categoryName}</span>
                        <span className="mt-1 block text-xs font-medium sm:hidden">{formatMoney(product.sellingPrice)} · {product.active ? 'Active' : 'Inactive'}</span>
                      </button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{product.brandName}</TableCell>
                    <TableCell className="hidden lg:table-cell">{product.categoryName}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(product.sellingPrice)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground xl:table-cell">{product.quantity ?? 0}</TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant={product.active ? 'secondary' : 'outline'} className={product.active ? 'bg-primary/10 text-primary' : ''}>{product.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}><Pencil /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><PackageSearch /></EmptyMedia>
                <EmptyTitle>No products found</EmptyTitle>
                <EmptyDescription>{query ? 'Try a different search.' : `There are no ${status === 'all' ? '' : `${status} `}products.`}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{pagination.total ? `${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}` : '0 products'}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="min-w-16 text-center text-foreground">{pagination.page} / {pagination.totalPages}</span>
            <Button variant="outline" size="icon" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages || loading} aria-label="Next page"><ChevronRight /></Button>
          </div>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full data-[side=right]:sm:max-w-xl">
          <form onSubmit={saveProduct} className="flex min-h-0 flex-1 flex-col">
            <SheetHeader className="border-b">
              <SheetTitle>{editing ? 'Edit product' : 'New product'}</SheetTitle>
              <SheetDescription className="sr-only">{editing ? `Edit ${editing.name}` : 'Create a product record'}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="product-sku">SKU</FieldLabel>
                    <Input id="product-sku" value={draft.sku} onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value.toUpperCase() }))} className="h-10 font-mono" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="product-name">Name</FieldLabel>
                    <Input id="product-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="h-10" required />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="product-description">Description</FieldLabel>
                  <Textarea id="product-description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Brand</FieldLabel>
                    <Select value={draft.brandId} onValueChange={selectBrand} required>
                      <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select brand" /></SelectTrigger>
                      <SelectContent><SelectGroup>{reference?.brands.map((brand) => <SelectItem key={brand.id} value={String(brand.id)}>{brand.name}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Category</FieldLabel>
                    <Select value={draft.categoryId} onValueChange={(value) => setDraft((current) => ({ ...current, categoryId: value }))} required>
                      <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent><SelectGroup>{availableCategories.map((category: ReferenceOption) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="selling-price">Selling price ({currency})</FieldLabel>
                  <Input id="selling-price" type="number" min="0" step="0.01" value={draft.sellingPrice} onChange={(event) => setDraft((current) => ({ ...current, sellingPrice: event.target.value }))} className="h-10" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Store</FieldLabel>
                    <Select value={draft.storeId || 'none'} onValueChange={(value) => setDraft((current) => ({ ...current, storeId: value === 'none' ? '' : value }))}>
                      <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select store" /></SelectTrigger>
                      <SelectContent><SelectGroup><SelectItem value="none">None</SelectItem>{availableStores.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="product-quantity">Quantity</FieldLabel>
                    <Input id="product-quantity" type="number" min="0" step="1" value={draft.quantity} disabled={!draft.storeId} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} className="h-10" />
                  </Field>
                </div>
                <p className="-mt-2 text-xs text-muted-foreground">
                  Stock is held per store, so choose the store this quantity sits in. Leave both blank to change only
                  the product details.
                </p>
                {editing ? (
                  <Field orientation="horizontal" className="rounded-md border bg-muted/35 px-3 py-3">
                    <div className="flex-1">
                      <FieldLabel htmlFor="product-active">Active product</FieldLabel>
                      <p className="text-xs text-muted-foreground">Inactive products remain in historical records.</p>
                    </div>
                    <Switch id="product-active" checked={draft.active} onCheckedChange={(active) => setDraft((current) => ({ ...current, active }))} />
                  </Field>
                ) : null}
                {saveError ? <FieldError>{saveError}</FieldError> : null}
              </FieldGroup>
            </div>
            <SheetFooter className="flex-row justify-end border-t bg-muted/25">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !draft.sku.trim() || !draft.name.trim() || !draft.brandId || !draft.categoryId}>
                {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                {editing ? 'Save product' : 'Create product'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
