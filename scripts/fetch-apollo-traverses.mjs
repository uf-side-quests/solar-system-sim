import { writeFile } from "node:fs/promises";
import { URL } from "node:url";

const MOON_RADIUS_M = 1_737_400;
const missions = [
  {
    number: 11,
    siteId: "apollo-11-site",
    latitudeDeg: 0.67416,
    longitudeDeg: 23.47314,
  },
  {
    number: 12,
    siteId: "apollo-12-site",
    latitudeDeg: -3.0128,
    longitudeDeg: -23.4219,
  },
  {
    number: 14,
    siteId: "apollo-14-site",
    latitudeDeg: -3.64589,
    longitudeDeg: -17.47194,
  },
];
const base =
  "https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/SHAPEFILE";

function projectedLandingPoint(mission) {
  const standardParallelDeg = mission.number === 11 ? 1 : -3;
  let relativeLongitudeDeg = mission.longitudeDeg - 180;
  while (relativeLongitudeDeg < -180) relativeLongitudeDeg += 360;
  while (relativeLongitudeDeg > 180) relativeLongitudeDeg -= 360;
  return {
    x:
      MOON_RADIUS_M *
      ((relativeLongitudeDeg * Math.PI) / 180) *
      Math.cos((standardParallelDeg * Math.PI) / 180),
    y: (MOON_RADIUS_M * mission.latitudeDeg * Math.PI) / 180,
  };
}

function parseWktPaths(csv, origin) {
  const paths = [];
  for (const match of csv.matchAll(/LINESTRING \(([^)]+)\)/g)) {
    const points = match[1].split(",").map((pair) => {
      const [xText, yText] = pair.trim().split(/\s+/);
      const x = Number(xText);
      const y = Number(yText);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error("LROC traverse contains a non-finite coordinate");
      }
      return [x - origin.x, y - origin.y];
    });
    paths.push(points);
  }
  return paths;
}

const sites = [];
for (const mission of missions) {
  const origin = projectedLandingPoint(mission);
  const paths = [];
  for (const eva of [1, 2]) {
    for (const role of ["CDR", "LMP"]) {
      const fileName = `APOLLO_${mission.number}-${eva}_${role}_PATHS.csv`;
      const sourceUrl = `${base}/APOLLO_${mission.number}/${fileName}`;
      const response = await fetch(sourceUrl);
      if (response.status === 404) continue;
      if (!response.ok) {
        throw new Error(`${sourceUrl} returned HTTP ${response.status}`);
      }
      const csv = await response.text();
      paths.push({
        eva,
        role,
        sourceUrl,
        segments: parseWktPaths(csv, origin),
      });
    }
  }
  if (paths.length === 0) {
    throw new Error(`Apollo ${mission.number} has no LROC traverse files`);
  }
  sites.push({ siteId: mission.siteId, paths });
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  authority: "NASA GSFC / Arizona State University LROC PDS",
  projection:
    "LROC mission equirectangular Moon coordinates converted to local metre offsets from the sourced landing coordinate",
  sites,
};
await writeFile(
  new URL("../src/data/apollo-traverses.snapshot.json", import.meta.url),
  `${JSON.stringify(snapshot)}\n`,
);
