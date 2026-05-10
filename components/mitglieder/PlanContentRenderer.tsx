// Rendert die generierte Plan-Content-JSON als schoene HTML-Sektionen.
// Walkt die Top-Level-Keys des Inhalts und wendet pro Key einen passenden
// Renderer an. Bekannte Keys (intro, morgens, snacks etc.) bekommen
// optimierte UI; unbekannte fallen auf einen sauberen Generic-Renderer.
//
// Server Component — kein State, keine Interaktivitaet noetig.

import React from "react";

type AnyVal = any;

interface KnownKey {
  title: string;
  icon: string;
}

const KNOWN_KEYS: Record<string, KnownKey> = {
  intro: { title: "Worum es geht", icon: "📖" },
  rasse_besonderheiten: { title: "Besonderheiten deiner Rasse", icon: "🐕" },
  morgens: { title: "Frühstück", icon: "☀️" },
  mittags: { title: "Mittag", icon: "🌞" },
  abends: { title: "Abend", icon: "🌙" },
  portionen: { title: "Portionen", icon: "🍽️" },
  naehrstoffe: { title: "Wichtige Nährstoffe", icon: "🧬" },
  snacks: { title: "Snacks & Belohnungen", icon: "🍪" },
  rezepte: { title: "Rezepte zum Selbermachen", icon: "👨‍🍳" },
  verboten: { title: "Verbotene Lebensmittel", icon: "⚠️" },
  notfall: { title: "Notfall-Maßnahmen", icon: "🚨" },
  haeufige_fehler: { title: "Häufige Fehler vermeiden", icon: "💡" },
  gewichtskontrolle: { title: "Gewichtskontrolle", icon: "⚖️" },
  futter_warnung: { title: "Futter-Warnsignale", icon: "👀" },
  wochenplan: { title: "Wochenplan auf einen Blick", icon: "📅" },
  einkauf: { title: "Einkaufsliste", icon: "🛒" },
  // Reise-spezifisch
  packliste: { title: "Packliste", icon: "🎒" },
  vorbereitung: { title: "Vorbereitung", icon: "✅" },
  // Erstehilfe
  symptome: { title: "Symptome erkennen", icon: "🔍" },
  massnahmen: { title: "Sofort-Maßnahmen", icon: "🚑" },
};

const DAY_LABELS: Record<string, string> = {
  Mo: "Montag",
  Di: "Dienstag",
  Mi: "Mittwoch",
  Do: "Donnerstag",
  Fr: "Freitag",
  Sa: "Samstag",
  So: "Sonntag",
};

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSectionMeta(key: string): KnownKey {
  return KNOWN_KEYS[key] || { title: humanize(key), icon: "•" };
}

// ── Section-Wrapper ────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[20px]">{icon}</span>
        <h2 className="text-[18px] md:text-[20px] font-extrabold text-[#1a1a1a] leading-tight">
          {title}
        </h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// ── Type-spezifische Renderer ──────────────────────────────────────

function ParagraphList({ items }: { items: string[] }) {
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 space-y-3">
      {items.map((p, i) => (
        <p
          key={i}
          className="text-[14px] text-[#1a1a1a] leading-relaxed"
        >
          {p}
        </p>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="bg-white border border-[#EADDC5] rounded-2xl p-5 space-y-2">
      {items.map((it, i) => (
        <li
          key={i}
          className="flex gap-2 text-[14px] text-[#1a1a1a] leading-relaxed"
        >
          <span className="text-[#C4A576] flex-shrink-0">•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedSteps({ items }: { items: string[] }) {
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 space-y-3">
      {items.map((it, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#C4A576] text-white flex items-center justify-center text-[13px] font-bold">
            {i + 1}
          </div>
          <p className="flex-1 pt-0.5 text-[14px] text-[#1a1a1a] leading-relaxed">
            {it}
          </p>
        </div>
      ))}
    </div>
  );
}

function MealCard({ data }: { data: any }) {
  // Erwartet { zeit, futter, zusatz, vorbereitung, tipp }
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-5">
      {data.zeit && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-2">
          {data.zeit}
        </p>
      )}
      <div className="space-y-2.5 text-[14px] text-[#1a1a1a]">
        {data.futter && (
          <p>
            <strong className="text-[#1a1a1a]">Futter:</strong>{" "}
            <span className="text-[#4B5563]">{data.futter}</span>
          </p>
        )}
        {data.zusatz && (
          <p>
            <strong>Zusatz:</strong>{" "}
            <span className="text-[#4B5563]">{data.zusatz}</span>
          </p>
        )}
        {data.vorbereitung && (
          <p>
            <strong>Vorbereitung:</strong>{" "}
            <span className="text-[#4B5563]">{data.vorbereitung}</span>
          </p>
        )}
      </div>
      {data.tipp && (
        <div className="mt-4 bg-[#FFF9F0] border-l-3 border-[#C4A576] rounded-r-lg px-4 py-2.5">
          <p className="text-[10px] font-bold text-[#8B7355] uppercase tracking-wide mb-0.5">
            Tipp
          </p>
          <p className="text-[13px] text-[#5A4A3A] leading-relaxed">
            {data.tipp}
          </p>
        </div>
      )}
    </div>
  );
}

function TupleTable({ rows }: { rows: any[] }) {
  // [name, value] pairs
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl overflow-hidden">
      <table className="w-full text-[13px]">
        <tbody>
          {rows.map((row, i) => {
            const [k, v] = Array.isArray(row) ? row : [String(i), row];
            return (
              <tr
                key={i}
                className={i % 2 === 0 ? "bg-[#FAFAFA]" : "bg-white"}
              >
                <td className="font-semibold text-[#1a1a1a] px-4 py-2.5 align-top w-1/3">
                  {String(k)}
                </td>
                <td className="text-[#4B5563] px-4 py-2.5">
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CardGrid({
  items,
  titleKey,
  descriptionKeys,
  accent,
}: {
  items: any[];
  titleKey: string;
  descriptionKeys: string[];
  accent?: string;
}) {
  const accentColor = accent || "#C4A576";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((it, i) => {
        if (typeof it === "string") {
          return (
            <div
              key={i}
              className="bg-white border border-[#EADDC5] rounded-xl p-4 text-[13px] text-[#1a1a1a]"
            >
              {it}
            </div>
          );
        }
        const title = it[titleKey] || it.title || it.name || `#${i + 1}`;
        return (
          <div
            key={i}
            className="bg-white border border-[#EADDC5] rounded-xl p-4"
            style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}
          >
            <p className="text-[14px] font-bold text-[#1a1a1a] mb-1.5 leading-tight">
              {title}
            </p>
            {descriptionKeys.map((dk) => {
              const v = it[dk];
              if (!v) return null;
              return (
                <p
                  key={dk}
                  className="text-[12px] text-[#6B7280] leading-snug mb-1"
                >
                  <strong className="text-[#4B5563]">{humanize(dk)}:</strong>{" "}
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function RecipeCards({ items }: { items: any[] }) {
  return (
    <div className="space-y-3">
      {items.map((r, i) => (
        <div
          key={i}
          className="bg-white border border-[#EADDC5] rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FFF9F0] text-[#8B7355] px-2 py-0.5 rounded">
              Rezept {i + 1}
            </span>
            {r.haltbar && (
              <span className="text-[10px] text-[#9CA3AF]">
                Haltbar: {r.haltbar}
              </span>
            )}
          </div>
          <h3 className="text-[16px] font-extrabold text-[#1a1a1a] leading-tight mb-2">
            {r.name || `Rezept ${i + 1}`}
          </h3>
          {r.zutaten && (
            <p className="text-[13px] text-[#4B5563] mb-3">
              <strong>Zutaten:</strong> {r.zutaten}
            </p>
          )}
          {Array.isArray(r.schritte) && r.schritte.length > 0 && (
            <ol className="space-y-1.5 mb-3">
              {r.schritte.map((s: string, si: number) => (
                <li
                  key={si}
                  className="flex gap-2 text-[13px] text-[#1a1a1a] leading-relaxed"
                >
                  <span className="text-[#C4A576] font-bold flex-shrink-0">
                    {si + 1}.
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
          {r.anlass && (
            <p className="text-[12px] text-[#6B7280]">
              <strong>Anlass:</strong> {r.anlass}
            </p>
          )}
          {r.variation && (
            <p className="text-[12px] text-[#6B7280] mt-1">
              <strong>Variation:</strong> {r.variation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function WeeklyPlan({ data }: { data: Record<string, any> }) {
  const days = Object.keys(data);
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-[#F0EBE3]">
        {days.map((day) => {
          const meals = data[day] || {};
          const label = DAY_LABELS[day] || day;
          return (
            <div key={day} className="p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B7355] mb-2">
                {label}
              </p>
              {meals.m && (
                <p className="text-[11px] text-[#1a1a1a] mb-1.5 leading-snug">
                  <span className="text-[#9CA3AF]">M:</span> {meals.m}
                </p>
              )}
              {meals.s && (
                <p className="text-[11px] text-[#1a1a1a] mb-1.5 leading-snug">
                  <span className="text-[#9CA3AF]">S:</span> {meals.s}
                </p>
              )}
              {meals.a && (
                <p className="text-[11px] text-[#1a1a1a] leading-snug">
                  <span className="text-[#9CA3AF]">A:</span> {meals.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShoppingList({ items }: { items: any[] }) {
  // [[category, [items]], ...]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((row, i) => {
        const [cat, list] = Array.isArray(row) ? row : [`Kategorie ${i + 1}`, row];
        return (
          <div
            key={i}
            className="bg-white border border-[#EADDC5] rounded-xl p-4"
          >
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#8B7355] mb-2">
              {String(cat)}
            </p>
            {Array.isArray(list) ? (
              <ul className="space-y-1">
                {list.map((it: string, j: number) => (
                  <li
                    key={j}
                    className="flex gap-2 text-[13px] text-[#1a1a1a] leading-snug"
                  >
                    <span className="text-[#C4A576] flex-shrink-0">☐</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[#1a1a1a]">{String(list)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GenericObject({ data }: { data: Record<string, any> }) {
  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-5 space-y-3">
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8B7355] mb-1">
            {humanize(k)}
          </p>
          {Array.isArray(v) ? (
            <ul className="space-y-1">
              {v.map((it, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] text-[#1a1a1a] leading-snug"
                >
                  <span className="text-[#C4A576] flex-shrink-0">•</span>
                  <span>{typeof it === "string" ? it : JSON.stringify(it)}</span>
                </li>
              ))}
            </ul>
          ) : typeof v === "object" && v !== null ? (
            <pre className="text-[11px] text-[#6B7280] whitespace-pre-wrap">
              {JSON.stringify(v, null, 2)}
            </pre>
          ) : (
            <p className="text-[13px] text-[#1a1a1a] leading-relaxed">
              {String(v)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Heuristik: welcher Renderer pro Section ────────────────────────

function renderSection(key: string, value: AnyVal): React.ReactNode {
  // Spezial-Keys
  if (
    ["morgens", "mittags", "abends"].includes(key) &&
    value &&
    typeof value === "object"
  ) {
    return <MealCard data={value} />;
  }
  if (key === "rezepte" && Array.isArray(value)) {
    return <RecipeCards items={value} />;
  }
  if (key === "wochenplan" && value && typeof value === "object") {
    return <WeeklyPlan data={value} />;
  }
  if (key === "einkauf" && Array.isArray(value)) {
    return <ShoppingList items={value} />;
  }
  if (key === "portionen" && Array.isArray(value)) {
    return <TupleTable rows={value} />;
  }
  if (key === "naehrstoffe" && Array.isArray(value)) {
    return (
      <CardGrid
        items={value}
        titleKey="name"
        descriptionKeys={["menge", "quellen", "erklaerung"]}
      />
    );
  }
  if (key === "snacks" && Array.isArray(value)) {
    return (
      <CardGrid
        items={value}
        titleKey="name"
        descriptionKeys={["menge", "info"]}
      />
    );
  }
  if (key === "verboten" && Array.isArray(value)) {
    return (
      <CardGrid
        items={value}
        titleKey="name"
        descriptionKeys={["grund", "symptome", "sofort"]}
        accent="#DC2626"
      />
    );
  }
  if (key === "haeufige_fehler" && Array.isArray(value)) {
    return (
      <CardGrid
        items={value}
        titleKey="fehler"
        descriptionKeys={["warum", "besser"]}
      />
    );
  }
  if (key === "notfall" && Array.isArray(value)) {
    return <NumberedSteps items={value.map((s) => String(s))} />;
  }
  if (key === "intro" && Array.isArray(value)) {
    return <ParagraphList items={value.map((s) => String(s))} />;
  }

  // Generic
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) {
      return <BulletList items={value} />;
    }
    if (value.every((v) => Array.isArray(v) && v.length === 2)) {
      return <TupleTable rows={value} />;
    }
    return (
      <CardGrid
        items={value}
        titleKey="name"
        descriptionKeys={Object.keys(value[0] || {}).filter(
          (k) => k !== "name" && k !== "title"
        )}
      />
    );
  }

  if (typeof value === "object" && value !== null) {
    return <GenericObject data={value} />;
  }

  return (
    <div className="bg-white border border-[#EADDC5] rounded-2xl p-5">
      <p className="text-[14px] text-[#1a1a1a]">{String(value)}</p>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────

export default function PlanContentRenderer({
  content,
}: {
  content: Record<string, any>;
}) {
  if (!content || typeof content !== "object") {
    return (
      <div className="bg-white border border-[#EADDC5] rounded-2xl p-6 text-center text-[#6B7280] text-[13px]">
        Inhalt konnte nicht geladen werden.
      </div>
    );
  }

  const entries = Object.entries(content);

  return (
    <div>
      {entries.map(([key, value]) => {
        const meta = getSectionMeta(key);
        return (
          <Section key={key} icon={meta.icon} title={meta.title}>
            {renderSection(key, value)}
          </Section>
        );
      })}
    </div>
  );
}
