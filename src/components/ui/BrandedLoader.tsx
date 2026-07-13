'use client';

import Image from 'next/image';
import { Layers3, LoaderCircle } from 'lucide-react';
import { useOrg } from '@/components/providers/OrgProvider';
import { cn } from '@/lib/utils';

export default function BrandedLoader({
  fullScreen = false,
  label = 'Loading...',
}: {
  fullScreen?: boolean;
  label?: string;
}) {
  const { org } = useOrg();
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-4 bg-background text-foreground',
        fullScreen ? 'min-h-svh' : 'min-h-[60vh]'
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
        {org.logo ? (
          <Image src={org.logo} alt="" width={32} height={32} className="size-8 rounded-md object-contain" unoptimized />
        ) : (
          <Layers3 className="size-5" aria-hidden="true" />
        )}
      </span>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <LoaderCircle className={cn('inline-block size-4 animate-spin align-[-2px]', className)} aria-hidden="true" />;
}
