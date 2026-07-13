import { InventoryDocumentForm } from '@/components/forms/InventoryDocumentForm';

export default function StoreTransferPage() {
  return <InventoryDocumentForm document="stock-transfer" backHref="/forms/store-manager" />;
}
