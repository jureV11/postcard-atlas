import type { Member, Postcard } from "@/lib/types";

export type CardBalance<T extends Member = Member> = {
  member: T;
  theySent: number; // cards from them that reached you
  youSent: number; // cards you sent them, arrived, lost or still on the way
};

/**
 * Who owes whom a postcard, between you and each friend still in the group.
 * Only uses what you can already see: cards you received, and your own cards
 * (a card of yours still in the post already counts, so you don't owe twice).
 * Their cards still on the way to you stay a secret, so they can't count yet.
 */
export function cardBalances<T extends Member>(meId: string, members: T[], cards: Postcard[]): CardBalance<T>[] {
  return members
    .filter((m) => m.id !== meId && !m.left_at)
    .map((m) => ({
      member: m,
      theySent: cards.filter((c) => c.sender_id === m.id && c.recipient_id === meId && c.status === "received").length,
      youSent: cards.filter((c) => c.sender_id === meId && c.recipient_id === m.id).length,
    }));
}

/** The friends you owe a card, most owed first. */
export const youOwe = <T extends Member>(balances: CardBalance<T>[]) =>
  balances.filter((b) => b.theySent > b.youSent).sort((a, b) => b.theySent - b.youSent - (a.theySent - a.youSent));

/** The friends who owe you one, most owed first. */
export const oweYou = <T extends Member>(balances: CardBalance<T>[]) =>
  balances.filter((b) => b.youSent > b.theySent).sort((a, b) => b.youSent - b.theySent - (a.youSent - a.theySent));
