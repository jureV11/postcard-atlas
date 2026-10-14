// Member colours — distinct enough to tell apart on a map. Stored lowercase.
export const MEMBER_COLORS = [
  { hex: "#d1495b", name: "Poppy" },
  { hex: "#2e86ab", name: "Sea" },
  { hex: "#edae49", name: "Mustard" },
  { hex: "#3b8b5a", name: "Fern" },
  { hex: "#7d5ba6", name: "Plum" },
  { hex: "#ef7b45", name: "Tangerine" },
  { hex: "#1b998b", name: "Teal" },
  { hex: "#c45ab3", name: "Orchid" },
  { hex: "#5c6b73", name: "Slate" },
  { hex: "#8c6239", name: "Cocoa" },
] as const;

export function firstFreeColor(taken: string[]): string {
  return (MEMBER_COLORS.find((c) => !taken.includes(c.hex)) ?? MEMBER_COLORS[0]).hex;
}
