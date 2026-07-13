import { InventoryDocumentForm } from '@/components/forms/InventoryDocumentForm';

export default function GoodsReceiptPage() {
  return <InventoryDocumentForm document="goods-receipt" backHref="/forms/inventory" />;
}
