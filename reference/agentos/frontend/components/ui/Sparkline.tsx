import { cn } from "../../lib/utils";

interface SparklineProps {
  data: number[];
  className?: string;
  stroke?: string;
  fill?: string;
}

export function Sparkline({
  data,
  className,
  stroke = "#8b5cf6",
  fill = "rgba(139,92,246,0.15)",
}: SparklineProps) {
  if (!data.length) {
    return null;
  }

  const width = 120;
  const height = 36;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / Math.max(data.length - 1, 1);

  const points = data.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-9 w-full", className)}
      preserveAspectRatio="none"
    >
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}
