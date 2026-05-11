// Sofort-Skeleton fuer /mitglieder/erfolge/stimmung.

export default function LoadingStimmung() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-32 bg-[#F0EBE3] rounded mb-3" />

      <div className="mb-5">
        <div className="h-3 w-32 bg-[#F0EBE3] rounded mb-2" />
        <div className="h-8 w-3/4 bg-[#F0EBE3] rounded mb-2" />
        <div className="h-3 w-2/3 bg-[#F0EBE3] rounded" />
      </div>

      {/* Wochen-Check Widget */}
      <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-6 h-72" />

      {/* Plan-Verlauf Cards */}
      <div className="space-y-2 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-[#EADDC5] rounded-xl p-4 h-20"
          />
        ))}
      </div>
    </div>
  );
}
