import { AssetDetailPageContent } from "@/components/ativos-detail/AssetDetailPageContent";

type Props = { params: { ticker: string } };

export default function AssetDetailPage({ params }: Props) {
  return <AssetDetailPageContent ticker={decodeURIComponent(params.ticker)} />;
}
