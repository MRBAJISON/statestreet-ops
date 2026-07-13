import { InventoryDocumentForm } from '@/components/forms/InventoryDocumentForm';

export default function StockTransferPage() {
  return <InventoryDocumentForm document="stock-transfer" backHref="/forms/inventory" />;
}
