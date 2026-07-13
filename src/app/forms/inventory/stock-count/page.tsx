import { InventoryDocumentForm } from '@/components/forms/InventoryDocumentForm';

export default function StockCountPage() {
  return <InventoryDocumentForm document="stock-count" backHref="/forms/inventory" />;
}
