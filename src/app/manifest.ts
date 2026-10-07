import type { MetadataRoute } from "next";

// Lets people add GiftLedger to their home screen; it opens full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GiftLedger: holiday gift planner",
    short_name: "GiftLedger",
    description: "Budgets, gift ideas, a shared family list and return reminders.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fcf8f3",
    theme_color: "#b4472f",
    categories: ["lifestyle", "shopping", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
