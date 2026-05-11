// Sofort-Skeleton fuer /mitglieder/erfolge/coaching.

export default function LoadingCoaching() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-32 bg-[#F0EBE3] rounded mb-3" />

      <div className="mb-5">
        <div className="h-3 w-32 bg-[#F0EBE3] rounded mb-2" />
        <div className="h-8 w-3/4 bg-[#F0EBE3] rounded mb-2" />
        <div className="h-3 w-2/3 bg-[#F0EBE3] rounded" />
      </div>

      {/* Tagestipp-Card */}
      <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 mb-6 h-40" />

      {/* Wochen-Liste */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-[#EADDC5] rounded-xl p-4 h-24"
          />
        ))}
      </div>
    </div>
  );
}
