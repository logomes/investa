type Props = {
  width?: number;
  height?: number;
};

export function ChartSkeleton({ width = 780, height = 300 }: Props) {
  return (
    <div
      className="bg-bg-2 border border-line rounded-card animate-pulse w-full"
      style={{ maxWidth: width, height }}
    />
  );
}
