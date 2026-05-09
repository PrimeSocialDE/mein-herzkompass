// SVG-Kreisdiagramm für Fortschritt. Funktioniert für:
// • Paid-User: zeigt freigeschaltete vs. gesamt
// • Free-User: leerer Kreis als Vorschau / "Schalte den Plan frei"
//
// Pure-CSS-Variante mit stroke-dasharray — keine Library nötig.

interface ProgressCircleProps {
  current: number;
  total: number;
  label?: string;
  sublabel?: string;
  size?: number; // px
}

export default function ProgressCircle({
  current,
  total,
  label,
  sublabel,
  size = 120,
}: ProgressCircleProps) {
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const percent = total > 0 ? Math.min(1, current / total) : 0;
  const dashOffset = circumference * (1 - percent);
  const center = size / 2;

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Hintergrund-Kreis */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="8"
          />
          {/* Fortschritts-Kreis */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#C4A576"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        {/* Center-Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[24px] font-extrabold text-[#1a1a1a] leading-none">
            {current}
            <span className="text-[14px] text-[#9CA3AF] font-bold">
              /{total}
            </span>
          </div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#8B7355] mt-1">
            Module
          </div>
        </div>
      </div>

      {(label || sublabel) && (
        <div className="flex-1 min-w-0">
          {label && (
            <p className="text-[15px] font-bold text-[#1a1a1a] leading-tight mb-0.5">
              {label}
            </p>
          )}
          {sublabel && (
            <p className="text-[12px] text-[#6B7280] leading-relaxed">
              {sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
