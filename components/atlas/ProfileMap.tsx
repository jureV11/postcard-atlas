"use client";

import { useMemo, useState } from "react";
import { AtlasPanel } from "@/components/atlas/AtlasPanel";
import { FlatMap } from "@/components/atlas/FlatMap";
import { deriveAtlas, type MapCard, type Selection } from "@/lib/atlas";
import type { MemberWithAvatar } from "@/lib/types";

/** One member's map: the cities and countries they've sent postcards from. */
export function ProfileMap({
  cards,
  member,
  members,
}: {
  cards: MapCard[]; // cards this member sent
  member: MemberWithAvatar;
  members: MemberWithAvatar[];
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const atlas = useMemo(() => deriveAtlas(cards, [member], null), [cards, member]);

  return (
    <div className="relative aspect-[4/3] max-h-[60vh] w-full overflow-hidden rounded-2xl border border-ink/10 bg-[#f3ede1] sm:aspect-[2/1]">
      <FlatMap
        cards={atlas.located}
        cities={atlas.cities}
        sentFrom={atlas.sentFrom}
        homes={atlas.homes}
        members={[member]}
        membersById={membersById}
        filterId={null}
        selection={selection}
        onSelect={setSelection}
        showArcs={false}
      />
      {selection && (
        <AtlasPanel
          selection={selection}
          onSelect={setSelection}
          onClose={() => setSelection(null)}
          cards={atlas.located}
          cities={atlas.cities}
          membersById={membersById}
        />
      )}
    </div>
  );
}
