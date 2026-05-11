// Sofort-Skeleton fuer /mitglieder/erfolge (Hub).
// Wird automatisch von Next.js angezeigt waehrend die Server-Page laedt.
// Verhindert die "weisse Seite" die User vorher gesehen haben.

export default function LoadingErfolgeHub() {
  return (
    <div className="animate-pulse">
      {/* Hero-Bild Platzhalter */}
      <div className="mb-5 -mx-4 md:-mx-8">
        <div className="w-full aspect-[16/7] bg-[#F0EBE3] md:rounded-2xl" />
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="h-3 w-20 bg-[#F0EBE3] rounded mb-2" />
        <div className="h-8 w-3/4 bg-[#F0EBE3] rounded mb-2" />
        <div className="h-3 w-2/3 bg-[#F0EBE3] rounded" />
      </div>

      {/* 3 Choice-Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 h-44">
          <div className="h-10 w-10 bg-[#F0EBE3] rounded mb-3" />
          <div className="h-5 w-1/2 bg-[#F0EBE3] rounded mb-2" />
          <div className="h-3 w-full bg-[#F0EBE3] rounded mb-1.5" />
          <div className="h-3 w-4/5 bg-[#F0EBE3] rounded" />
        </div>
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 h-44">
          <div className="h-10 w-10 bg-[#F0EBE3] rounded mb-3" />
          <div className="h-5 w-1/2 bg-[#F0EBE3] rounded mb-2" />
          <div className="h-3 w-full bg-[#F0EBE3] rounded mb-1.5" />
          <div className="h-3 w-4/5 bg-[#F0EBE3] rounded" />
        </div>
        <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 sm:col-span-2 h-44">
          <div className="h-10 w-10 bg-[#F0EBE3] rounded mb-3" />
          <div className="h-5 w-1/2 bg-[#F0EBE3] rounded mb-2" />
          <div className="h-3 w-full bg-[#F0EBE3] rounded mb-1.5" />
          <div className="h-3 w-4/5 bg-[#F0EBE3] rounded" />
        </div>
      </div>
    </div>
  );
}
