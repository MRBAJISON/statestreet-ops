'use client';

import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { downloadFile } from '@/lib/download-file';

interface RowError {
  sheet: string;
  row: number;
  message: string;
}

interface StoreOption {
  id: number;
  name: string;
  brandName: string | null;
  importable: boolean;
}

interface ImportResult {
  preview?: boolean;
  applied?: boolean;
  storeName: string;
  brandName: string | null;
  products: number;
  totalRows: number;
  errors: RowError[];
  productsWritten?: number;
  stockWritten?: number;
}

export default function CatalogImportPanel() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeId, setStoreId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch('/api/import/catalog', { cache: 'no-store' });
      if (!response.ok || cancelled) return;
      const payload = (await response.json()) as { stores: StoreOption[] };
      if (!cancelled) setStores(payload.stores);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = stores.find((store) => String(store.id) === storeId) ?? null;

  async function send(apply: boolean) {
    if (!file || !storeId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('storeId', storeId);
      if (apply) body.set('apply', 'true');
      const response = await fetch('/api/import/catalog', { method: 'POST', body });
      const payload = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'The import could not be processed');
      setResult(payload);
      if (apply) setFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The import could not be processed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Product catalogue import</CardTitle>
          <CardDescription>
            Load one store&apos;s products and opening stock from a spreadsheet. Products are matched on SKU, so
            uploading a corrected file updates the existing entries rather than creating duplicates.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field className="max-w-sm">
            <FieldLabel>Store</FieldLabel>
            <Select
              value={storeId}
              onValueChange={(value) => {
                setStoreId(value);
                setResult(null);
              }}
              disabled={busy}
            >
              <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choose a store" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={String(store.id)} disabled={!store.importable}>
                      {store.name}
                      {store.brandName ? ` · ${store.brandName}` : ' · no brand mapped'}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {selected ? (
              <p className="text-xs text-muted-foreground">
                Products will be filed under {selected.brandName}, and the quantities become this store&apos;s stock.
              </p>
            ) : null}
          </Field>

          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadFile('/api/import/catalog/template', 'product-catalog-template.xlsx')}
            >
              <Download /> Download the template
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">
              One Products sheet — SKU/Barcode, Product Name, Category, Selling Price and Quantity — plus a Categories
              sheet listing the exact names the file will accept. The store and brand are not in the file; they come
              from the choice above.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".xlsx"
              className="max-w-sm"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
            <Button type="button" disabled={!file || !storeId || busy} onClick={() => send(false)}>
              <Upload /> Check the file
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!file || !storeId || busy || !result?.preview}
              onClick={() => send(true)}
            >
              Apply the import
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {result ? (
            <div className="flex flex-col gap-3 rounded-md border p-4">
              <p className="text-sm font-medium">
                {result.applied
                  ? `Import applied to ${result.storeName}`
                  : `Checked against ${result.storeName} — nothing has been saved yet`}
              </p>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Products</dt><dd className="font-medium">{result.products}</dd></div>
                <div><dt className="text-muted-foreground">Rows read</dt><dd className="font-medium">{result.totalRows}</dd></div>
                <div><dt className="text-muted-foreground">Rejected</dt><dd className="font-medium">{result.errors.length}</dd></div>
                {result.applied ? (
                  <div><dt className="text-muted-foreground">Stock rows</dt><dd className="font-medium">{result.stockWritten ?? 0}</dd></div>
                ) : null}
              </dl>

              {result.errors.length ? (
                <div className="max-h-64 overflow-y-auto rounded border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="p-2">Row</th><th className="p-2">Problem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((rowError) => (
                        <tr key={`${rowError.sheet}-${rowError.row}`} className="border-b last:border-b-0">
                          <td className="p-2 tabular-nums">{rowError.row}</td>
                          <td className="p-2">{rowError.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {!result.applied && result.errors.length ? (
                <p className="text-sm text-muted-foreground">
                  Rejected rows are skipped; the rest will still be imported. Fix them and upload again if you want
                  them included.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
