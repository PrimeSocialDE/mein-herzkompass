import Link from "next/link";

export default function ModulePlaceholder() {
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-8 text-center">
      <h1 className="text-[20px] font-extrabold text-[#1a1a1a] mb-2">Module</h1>
      <p className="text-[14px] text-[#6B7280] mb-4">
        Eine eigene Module-Übersicht kommt in der nächsten Version. Solange:
        deine Module siehst du auf der Übersicht.
      </p>
      <Link
        href="/mitglieder"
        className="inline-block bg-[#C4A576] hover:bg-[#B5946A] text-white font-semibold py-2.5 px-5 rounded-xl text-[14px]"
      >
        Zur Übersicht
      </Link>
    </div>
  );
}
