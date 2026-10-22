/** Two looks for the map: plain paper, or a colourful vintage-atlas style. */
export type MapStyle = {
  ocean: string | null; // null = no ocean fill (paper background shows through)
  land: (colorIndex: number) => string;
  border: string;
  sentFrom: string;
  sentFromEdge: string;
  homeOpacity: number;
  graticule: string;
  graticuleOpacity: number;
};

const PASTELS = ["#f3d3c1", "#e2e9bd", "#f6e3a3", "#d9cfee", "#c8e4d0", "#f0c9d6"];

export const PLAIN: MapStyle = {
  ocean: null,
  land: () => "#e4dac6",
  border: "#fbf8f2",
  sentFrom: "#efd5ab",
  sentFromEdge: "#c98d3c",
  homeOpacity: 0.4,
  graticule: "#2a2622",
  graticuleOpacity: 0.06,
};

export const COLOURFUL: MapStyle = {
  ocean: "#bcdbe6",
  land: (i) => PASTELS[i % PASTELS.length],
  border: "#ffffff",
  sentFrom: "#f0a945",
  sentFromEdge: "#9a5a12",
  homeOpacity: 0.55,
  graticule: "#ffffff",
  graticuleOpacity: 0.5,
};
