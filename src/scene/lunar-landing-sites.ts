import { z } from "zod";

const apolloSiteSchema = z.object({
  id: z.enum([
    "apollo-11-site",
    "apollo-12-site",
    "apollo-14-site",
    "apollo-15-site",
    "apollo-16-site",
    "apollo-17-site",
  ]),
  mission: z.enum([
    "Apollo 11",
    "Apollo 12",
    "Apollo 14",
    "Apollo 15",
    "Apollo 16",
    "Apollo 17",
  ]),
  siteName: z.string().min(1),
  lunarModule: z.string().min(1),
  latitudeDeg: z.number().min(-90).max(90),
  longitudeDeg: z.number().min(-180).max(180),
  landingDateUtc: z.iso.date(),
  moonwalkers: z.array(z.string().min(1)).length(2),
  commandModulePilot: z.string().min(1),
  surfaceStayHours: z.number().positive(),
  evaHours: z.number().positive(),
  traverseDistanceKm: z.number().nonnegative(),
  experiments: z.array(z.string().min(1)).min(1),
  mappingUrl: z.url(),
  photoArchiveUrl: z.url(),
  sourceUrl: z.url(),
});

export const APOLLO_COORDINATES_SOURCE_URL =
  "https://www.nasa.gov/wp-content/uploads/static/history/afj/pdf/abtn-202402.pdf";

export const apolloLandingSites = apolloSiteSchema
  .array()
  .length(6)
  .parse([
    {
      id: "apollo-11-site",
      mission: "Apollo 11",
      siteName: "Tranquility Base",
      lunarModule: "Eagle",
      latitudeDeg: 0.67416,
      longitudeDeg: 23.47314,
      landingDateUtc: "1969-07-20",
      moonwalkers: ["Neil Armstrong", "Buzz Aldrin"],
      commandModulePilot: "Michael Collins",
      surfaceStayHours: 21.6,
      evaHours: 2.53,
      traverseDistanceKm: 0.25,
      experiments: [
        "Passive Seismic Experiment",
        "Laser Ranging Retroreflector",
        "Solar Wind Composition Experiment",
      ],
      mappingUrl:
        "https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_APOLLO_11",
      photoArchiveUrl:
        "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a11/images11.html",
      sourceUrl:
        "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11ov.html",
    },
    {
      id: "apollo-12-site",
      mission: "Apollo 12",
      siteName: "Ocean of Storms",
      lunarModule: "Intrepid",
      latitudeDeg: -3.0128,
      longitudeDeg: -23.4219,
      landingDateUtc: "1969-11-19",
      moonwalkers: ["Pete Conrad", "Alan Bean"],
      commandModulePilot: "Richard Gordon",
      surfaceStayHours: 31.52,
      evaHours: 7.75,
      traverseDistanceKm: 2.3,
      experiments: [
        "Apollo Lunar Surface Experiments Package",
        "Solar Wind Spectrometer",
        "Surveyor 3 inspection and sample return",
      ],
      mappingUrl:
        "https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_APOLLO_12",
      photoArchiveUrl:
        "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a12/images12.html",
      sourceUrl:
        "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a12/a12ov.html",
    },
    {
      id: "apollo-14-site",
      mission: "Apollo 14",
      siteName: "Fra Mauro",
      lunarModule: "Antares",
      latitudeDeg: -3.64589,
      longitudeDeg: -17.47194,
      landingDateUtc: "1971-02-05",
      moonwalkers: ["Alan Shepard", "Edgar Mitchell"],
      commandModulePilot: "Stuart Roosa",
      surfaceStayHours: 33.52,
      evaHours: 9.38,
      traverseDistanceKm: 3.3,
      experiments: [
        "Apollo Lunar Surface Experiments Package",
        "Active Seismic Experiment",
        "Laser Ranging Retroreflector",
      ],
      mappingUrl:
        "https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_APOLLO_14",
      photoArchiveUrl:
        "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a14/images14.html",
      sourceUrl:
        "https://www.nasa.gov/missions/apollo/apollo-14-mission-details/",
    },
    {
      id: "apollo-15-site",
      mission: "Apollo 15",
      siteName: "Hadley-Apennine",
      lunarModule: "Falcon",
      latitudeDeg: 26.13239,
      longitudeDeg: 3.6333,
      landingDateUtc: "1971-07-30",
      moonwalkers: ["David Scott", "James Irwin"],
      commandModulePilot: "Alfred Worden",
      surfaceStayHours: 66.92,
      evaHours: 18.55,
      traverseDistanceKm: 27.9,
      experiments: [
        "Apollo Lunar Surface Experiments Package",
        "Heat Flow Experiment",
        "First Lunar Roving Vehicle traverses",
      ],
      mappingUrl:
        "https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_APOLLO_15",
      photoArchiveUrl:
        "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a15/images15.html",
      sourceUrl:
        "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a15/a15ov.html",
    },
    {
      id: "apollo-16-site",
      mission: "Apollo 16",
      siteName: "Descartes Highlands",
      lunarModule: "Orion",
      latitudeDeg: -8.9734,
      longitudeDeg: 15.5011,
      landingDateUtc: "1972-04-21",
      moonwalkers: ["John Young", "Charles Duke"],
      commandModulePilot: "Ken Mattingly",
      surfaceStayHours: 71.03,
      evaHours: 20.23,
      traverseDistanceKm: 26.7,
      experiments: [
        "Apollo Lunar Surface Experiments Package",
        "Active Seismic Experiment",
        "Far-Ultraviolet Camera and Lunar Roving Vehicle",
      ],
      mappingUrl:
        "https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_APOLLO_16",
      photoArchiveUrl:
        "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a16/images16.html",
      sourceUrl:
        "https://www.nasa.gov/history/apollo-16-on-the-moon-at-descartes/",
    },
    {
      id: "apollo-17-site",
      mission: "Apollo 17",
      siteName: "Taurus-Littrow",
      lunarModule: "Challenger",
      latitudeDeg: 20.1911,
      longitudeDeg: 30.7723,
      landingDateUtc: "1972-12-11",
      moonwalkers: ["Eugene Cernan", "Harrison Schmitt"],
      commandModulePilot: "Ronald Evans",
      surfaceStayHours: 74.98,
      evaHours: 22.07,
      traverseDistanceKm: 35.7,
      experiments: [
        "Apollo Lunar Surface Experiments Package",
        "Lunar Seismic Profiling Experiment",
        "Surface Electrical Properties and Lunar Roving Vehicle traverses",
      ],
      mappingUrl:
        "https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_APOLLO_17",
      photoArchiveUrl:
        "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a17/images17.html",
      sourceUrl:
        "https://www.nasa.gov/missions/apollo/apollo-17-mission-details/",
    },
  ]);

export type ApolloLandingSite = (typeof apolloLandingSites)[number];

export const apolloLandingSiteById = new Map(
  apolloLandingSites.map((site) => [site.id, site]),
);

export function isApolloLandingSiteId(
  bodyId: string,
): bodyId is ApolloLandingSite["id"] {
  return apolloLandingSiteById.has(bodyId as ApolloLandingSite["id"]);
}

export function moonFixedSurfaceUnitVector(
  latitudeDeg: number,
  longitudeDeg: number,
): readonly [number, number, number] {
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) {
    throw new Error("Lunar site latitude must be between -90 and 90 degrees");
  }
  if (
    !Number.isFinite(longitudeDeg) ||
    longitudeDeg < -180 ||
    longitudeDeg > 180
  ) {
    throw new Error(
      "Lunar site longitude must be between -180 and 180 degrees",
    );
  }
  const latitudeRad = (latitudeDeg * Math.PI) / 180;
  const longitudeRad = (longitudeDeg * Math.PI) / 180;
  const cosLatitude = Math.cos(latitudeRad);
  return [
    cosLatitude * Math.cos(longitudeRad),
    Math.sin(latitudeRad),
    -cosLatitude * Math.sin(longitudeRad),
  ];
}
