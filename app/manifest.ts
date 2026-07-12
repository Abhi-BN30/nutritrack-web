import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LCHF",
    short_name: "LCHF",
    description: "Nutrition, biometrics, and patient analytics.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8faf7",
    theme_color: "#245b35",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
