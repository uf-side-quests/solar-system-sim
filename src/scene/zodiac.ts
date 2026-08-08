export type ZodiacSign = Readonly<{
  name: string;
  glyph: string;
  startLongitudeDeg: number;
  centreLongitudeDeg: number;
}>;

const ZODIAC_NAMES = [
  ["Aries", "♈"],
  ["Taurus", "♉"],
  ["Gemini", "♊"],
  ["Cancer", "♋"],
  ["Leo", "♌"],
  ["Virgo", "♍"],
  ["Libra", "♎"],
  ["Scorpio", "♏"],
  ["Sagittarius", "♐"],
  ["Capricorn", "♑"],
  ["Aquarius", "♒"],
  ["Pisces", "♓"],
] as const;

export const TROPICAL_ZODIAC_SIGNS: readonly ZodiacSign[] = ZODIAC_NAMES.map(
  ([name, glyph], index) => ({
    name,
    glyph,
    startLongitudeDeg: index * 30,
    centreLongitudeDeg: index * 30 + 15,
  }),
);

export function eclipticDirection(
  longitudeDeg: number,
): readonly [number, number, number] {
  return eclipticSkyDirection(longitudeDeg, 0);
}

export function eclipticSkyDirection(
  longitudeDeg: number,
  latitudeDeg: number,
): readonly [number, number, number] {
  if (!Number.isFinite(longitudeDeg) || !Number.isFinite(latitudeDeg)) {
    throw new Error("Ecliptic longitude and latitude must be finite");
  }
  const longitudeRad = (longitudeDeg * Math.PI) / 180;
  const latitudeRad = (latitudeDeg * Math.PI) / 180;
  const latitudeRadius = Math.cos(latitudeRad);
  return [
    Math.cos(longitudeRad) * latitudeRadius,
    Math.sin(longitudeRad) * latitudeRadius,
    Math.sin(latitudeRad),
  ];
}
