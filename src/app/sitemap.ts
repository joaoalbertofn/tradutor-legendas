import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { absoluteUrl } from "@/lib/siteConfig";

export default function sitemap(): MetadataRoute.Sitemap {
  const latestGuideDate = GUIDES.reduce(
    (latest, guide) => (guide.updatedAt > latest ? guide.updatedAt : latest),
    "2026-11-22"
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(latestGuideDate),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/guias"),
      lastModified: new Date(latestGuideDate),
      changeFrequency: "weekly",
      priority: 0.85,
    },
  ];

  const guideRoutes: MetadataRoute.Sitemap = GUIDES.map((guide) => ({
    url: absoluteUrl(`/guias/${guide.slug}`),
    lastModified: new Date(guide.updatedAt),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...guideRoutes];
}
