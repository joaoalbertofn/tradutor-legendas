import { describe, expect, it } from "vitest";
import { GUIDES, getGuideBySlug, getRelatedGuides } from "./guides";
import { absoluteUrl, SITE_URL } from "./siteConfig";

describe("SEO guides & siteConfig", () => {
  it("contains 5 unique SEO guides with valid metadata and FAQs", () => {
    expect(GUIDES).toHaveLength(5);

    const slugs = new Set(GUIDES.map((g) => g.slug));
    expect(slugs.size).toBe(5);

    for (const guide of GUIDES) {
      expect(guide.slug).toMatch(/^[a-z0-9-]+$/);
      expect(guide.metaTitle.length).toBeGreaterThanOrEqual(25);
      expect(guide.metaTitle.length).toBeLessThanOrEqual(65);
      expect(guide.metaDescription.length).toBeGreaterThanOrEqual(110);
      expect(guide.metaDescription.length).toBeLessThanOrEqual(170);
      expect(guide.directAnswer.length).toBeGreaterThan(50);
      expect(guide.sections.length).toBeGreaterThanOrEqual(3);
      expect(guide.faqs.length).toBeGreaterThanOrEqual(3);
      expect(getGuideBySlug(guide.slug)?.slug).toBe(guide.slug);

      const related = getRelatedGuides(guide.slug, 3);
      expect(related).toHaveLength(3);
      expect(related.every((r) => r.slug !== guide.slug)).toBe(true);
    }
  });

  it("builds valid absolute URLs from SITE_URL", () => {
    expect(SITE_URL).toMatch(/^https?:\/\/[^/]+$/);
    expect(absoluteUrl("/")).toBe(SITE_URL);
    expect(absoluteUrl("/guias")).toBe(`${SITE_URL}/guias`);
    expect(absoluteUrl("sitemap.xml")).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
