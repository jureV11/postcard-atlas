import type { MetadataRoute } from "next";

/** Lets phones install the site as an app ("Add to Home Screen"): name, icons, full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Postcard Atlas",
    short_name: "Postcards",
    description: "Every postcard our group sends, on one map.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f0e4",
    theme_color: "#f6f0e4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
