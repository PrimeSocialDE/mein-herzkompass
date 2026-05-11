// Sofort-Skeleton fuer /mitglieder/erfolge/challenges.
// Layout matched die echte Seite (Hero + Header + Aufgaben-Cards).

export default function LoadingChallenges() {
  return (
    <div className="animate-pulse">
      {/* Back-Link */}
      <div className="h-3 w-32 bg-[#F0EBE3] rounded mb-3" />

      {/* Hero */}
      <div className="mb-5 -mx-4 md:-mx-8">
        <div className="w-full aspect-[16/7] bg-[#F0EBE3] md:rounded-2xl" />
      </div>

      {/* Header */}
      <div className="mb-5">
        <div className="h-3 w-24 bg-[#F0EBE3] rounded mb-2" />
        <div className="h-8 w-2/3 bg-[#F0EBE3] rounded mb-2" />
        <div className="h-3 w-3/4 bg-[#F0EBE3] rounded" />
      </div>

      {/* Status-Strip */}
      <div className="bg-white border border-[#EADDC5] rounded-2xl px-4 py-3 mb-5 h-12" />

      {/* 2-3 Aufgaben-Cards */}
      <div className="space-y-3 mb-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white border border-[#EADDC5] rounded-2xl p-4 h-32"
          >
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-[#F0EBE3] rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-[#F0EBE3] rounded mb-2" />
                <div className="h-3 w-full bg-[#F0EBE3] rounded mb-1.5" />
                <div className="h-3 w-5/6 bg-[#F0EBE3] rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Badge-Wand-Platzhalter */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-[#EADDC5] rounded-xl h-24"
          />
        ))}
      </div>
    </div>
  );
}
