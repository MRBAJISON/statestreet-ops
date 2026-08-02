import { Button } from '@/components/ui/button';

export function ShowMoreButton({
  expanded,
  hiddenCount,
  canExpand,
  onClick,
}: {
  expanded: boolean;
  hiddenCount: number;
  canExpand: boolean;
  onClick: () => void;
}) {
  if (!canExpand) return null;
  return (
    <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={onClick}>
      {expanded ? 'Show less' : `Show ${hiddenCount} more`}
    </Button>
  );
}
