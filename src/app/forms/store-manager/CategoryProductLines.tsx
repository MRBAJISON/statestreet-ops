'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { derivedLineValue, nextProductKey, type DailyProductDraftRow } from '@/lib/daily-report-form';

interface SearchResult {
  id: number;
  sku: string;
  name: string;
  barcode: string | null;
  size: string | null;
  color: string | null;
  sellingPrice: string | null;
  brandName: string;
  quantity?: number | null;
}

function describe(product: SearchResult) {
  const stock = product.quantity == null ? null : `${product.quantity} in stock`;
  return [product.sku, product.size, product.color, stock].filter(Boolean).join(' · ');
}

/**
 * The product lines behind one category. Units are typed; the value follows the
 * catalogue price unless the manager corrects it. Lines may add up to less than
 * the category total — anything not in the catalogue goes on a free-typed line
 * rather than blocking the day.
 */
export function CategoryProductLines({
  categoryName,
  products,
  storeId,
  disabled,
  onChange,
}: {
  categoryName: string;
  products: DailyProductDraftRow[];
  storeId: number | null;
  disabled?: boolean;
  onChange: (products: DailyProductDraftRow[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '25' });
        if (query.trim()) params.set('q', query.trim());
        if (storeId) params.set('storeId', String(storeId));
        const response = await fetch(`/api/products?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { products: SearchResult[] };
        setResults(payload.products);
      } catch {
        // An aborted search is the normal case while typing; leave the last results.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, storeId]);

  function update(key: string, patch: Partial<DailyProductDraftRow>) {
    onChange(products.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function setUnits(row: DailyProductDraftRow, units: string) {
    // An overridden value is the manager's figure and is left alone; otherwise the
    // value follows the catalogue price.
    const nextValue = row.valueOverridden ? row.lineValue : derivedLineValue(units, row.unitPrice) ?? row.lineValue;
    update(row.key, { unitsSold: units, lineValue: nextValue });
  }

  function addFromCatalog(product: SearchResult) {
    onChange([
      ...products,
      {
        key: nextProductKey(),
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitsSold: '1',
        lineValue: derivedLineValue('1', product.sellingPrice) ?? '0.00',
        valueOverridden: false,
        unitPrice: product.sellingPrice,
      },
    ]);
    setQuery('');
    setOpen(false);
  }

  function addFreeText() {
    onChange([
      ...products,
      {
        key: nextProductKey(),
        productId: null,
        name: '',
        sku: null,
        unitsSold: '',
        lineValue: '',
        valueOverridden: true,
        unitPrice: null,
      },
    ]);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {products.map((row) => (
        <div key={row.key} className="flex flex-wrap items-center gap-2">
          {row.productId ? (
            <span className="min-w-40 flex-1 truncate text-sm">
              {row.name}
              {row.sku ? <span className="ml-2 text-xs text-muted-foreground">{row.sku}</span> : null}
            </span>
          ) : (
            <Input
              aria-label={`${categoryName}: item not in catalogue`}
              placeholder="Item not in catalogue"
              className="min-w-40 flex-1"
              value={row.name}
              disabled={disabled}
              onChange={(event) => update(row.key, { name: event.target.value })}
            />
          )}
          <Input
            aria-label={`${categoryName}: ${row.name || 'item'} units`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="Units"
            className="w-24"
            value={row.unitsSold}
            disabled={disabled}
            onChange={(event) => setUnits(row, event.target.value)}
          />
          <Input
            aria-label={`${categoryName}: ${row.name || 'item'} value`}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            placeholder="Value"
            className="w-28"
            value={row.lineValue}
            disabled={disabled}
            onChange={(event) => update(row.key, { lineValue: event.target.value, valueOverridden: true })}
          />
          {row.valueOverridden && row.unitPrice ? (
            <span className="text-xs text-muted-foreground">edited</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${row.name || 'item'}`}
            disabled={disabled}
            onClick={() => onChange(products.filter((item) => item.key !== row.key))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-fit" disabled={disabled}>
            <Plus /> Add product
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Barcode, SKU or name" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{loading ? 'Searching…' : 'No products found.'}</CommandEmpty>
              <CommandGroup heading="Products">
                {results.map((product) => (
                  <CommandItem key={product.id} value={String(product.id)} onSelect={() => addFromCatalog(product)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{describe(product)}</span>
                    </span>
                    {product.sellingPrice ? <span className="text-xs tabular-nums">{product.sellingPrice}</span> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={addFreeText}>
              Not in the catalogue — type it instead
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
