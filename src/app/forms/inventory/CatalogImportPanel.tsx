'use client';

import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { downloadFile } from '@/lib/download-file';

interface RowError {
  sheet: string;
  row: number;
  message: string;
}

interface ImportResult {
  preview?: boolean;
  applied?: boolean;
  products: number;
  stockRows: number;
  totalRows: number;
  errors: RowError[];
  productsWritten?: number;
  stockWritten?: number;
  unmatchedStockRows?: number;
}

export default function CatalogImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(apply: boolean) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('file', file);
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
            Load products and each store&apos;s opening stock from one spreadsheet. Products are matched on SKU, so
            uploading a corrected file updates the existing entries rather than creating duplicates.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadFile('/api/import/catalog/template', 'product-catalog-template.xlsx')}
            >
              <Download /> Download the template
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">
              The template has a Products sheet, a Store Stock sheet, and a Reference sheet listing the exact brand,
              category and store names the file will accept.
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
            <Button type="button" disabled={!file || busy} onClick={() => send(false)}>
              <Upload /> Check the file
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!file || busy || !result?.preview}
              onClick={() => send(true)}
            >
              Apply the import
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {result ? (
            <div className="flex flex-col gap-3 rounded-md border p-4">
              <p className="text-sm font-medium">
                {result.applied ? 'Import applied' : 'Checked — nothing has been saved yet'}
              </p>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Products</dt><dd className="font-medium">{result.products}</dd></div>
                <div><dt className="text-muted-foreground">Stock rows</dt><dd className="font-medium">{result.stockRows}</dd></div>
                <div><dt className="text-muted-foreground">Rows read</dt><dd className="font-medium">{result.totalRows}</dd></div>
                <div><dt className="text-muted-foreground">Rejected</dt><dd className="font-medium">{result.errors.length}</dd></div>
              </dl>

              {result.applied && result.unmatchedStockRows ? (
                <p className="text-sm text-muted-foreground">
                  {result.unmatchedStockRows} stock row(s) named a SKU that is not in the catalogue and were skipped.
                  Add those products and upload the stock again.
                </p>
              ) : null}

              {result.errors.length ? (
                <div className="max-h-64 overflow-y-auto rounded border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="p-2">Sheet</th><th className="p-2">Row</th><th className="p-2">Problem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((rowError) => (
                        <tr key={`${rowError.sheet}-${rowError.row}`} className="border-b last:border-b-0">
                          <td className="p-2">{rowError.sheet}</td>
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
