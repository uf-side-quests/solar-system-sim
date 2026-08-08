import { z } from "zod";

import snapshotJson from "../data/apollo-traverses.snapshot.json";

const pointSchema = z.tuple([z.number(), z.number()]);
const pathSchema = z.object({
  eva: z.number().int().min(1).max(3),
  role: z.enum(["CDR", "LMP"]),
  sourceUrl: z.url(),
  segments: z.array(z.array(pointSchema).min(2)).min(1),
});
const snapshotSchema = z.object({
  generatedAt: z.iso.datetime(),
  authority: z.string().min(1),
  projection: z.string().min(1),
  sites: z.array(
    z.object({
      siteId: z.enum(["apollo-11-site", "apollo-12-site", "apollo-14-site"]),
      paths: z.array(pathSchema).min(1),
    }),
  ),
});

export const apolloTraverseSnapshot = snapshotSchema.parse(snapshotJson);
export const apolloTraversesBySiteId = new Map(
  apolloTraverseSnapshot.sites.map((site) => [site.siteId, site]),
);

export function apolloTraverseForSiteId(siteId: string) {
  return apolloTraverseSnapshot.sites.find((site) => site.siteId === siteId);
}
