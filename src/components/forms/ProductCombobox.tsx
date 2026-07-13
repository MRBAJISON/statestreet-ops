'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ProductOption {
  id: number;
  sku: string;
  name: string;
  brandName: string;
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? 'Products could not be loaded';
}

export function ProductCombobox({
  value,
  onChange,
  disabled,
  allowedBrandIds,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowedBrandIds?: readonly number[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const brandFilter = allowedBrandIds
    ? [...new Set(allowedBrandIds)].sort((left, right) => left - right).join(',')
    : null;

  useEffect(() => {
    if (!open) return;
    if (brandFilter === '') {
      setProducts([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (query.trim()) params.set('q', query.trim());
        if (brandFilter) params.set('brandIds', brandFilter);
        const response = await fetch(`/api/products?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(await responseError(response));
        const payload = (await response.json()) as { products: ProductOption[] };
        setProducts(payload.products);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [brandFilter, open, query]);

  const selected = products.find((product) => String(product.id) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? `${selected.sku} · ${selected.name}` : value ? `Product #${value}` : 'Select a product'}
          </span>
          <ChevronsUpDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search SKU or product" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{loading ? 'Searching…' : 'No products found.'}</CommandEmpty>
            <CommandGroup heading="Products">
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={String(product.id)}
                  data-checked={String(product.id) === value}
                  onSelect={() => {
                    onChange(String(product.id));
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{product.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{product.sku} · {product.brandName}</span>
                  </span>
                  {String(product.id) === value ? <Check /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
