export type BodyCompositionFact = {
  readonly summary: string;
  readonly authority: string;
  readonly sourceUrl: string;
};

const NASA_SCIENCE = "NASA Science";

export const BODY_COMPOSITION_BY_ID: Readonly<
  Record<string, BodyCompositionFact>
> = {
  sun: {
    summary: "Hydrogen and helium plasma, with trace heavier elements",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/sun/facts/",
  },
  mercury: {
    summary: "Large iron-rich metallic core with a silicate mantle and crust",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/mercury/facts/",
  },
  venus: {
    summary: "Iron core, rocky silicate mantle and basaltic crust",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/venus/facts/",
  },
  earth: {
    summary: "Iron-nickel core, silicate mantle and crust, with surface water",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/earth/facts/",
  },
  mars: {
    summary:
      "Iron, nickel and sulfur core with a rocky silicate mantle and crust",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/mars/facts/",
  },
  jupiter: {
    summary: "Mostly hydrogen and helium, with a denser heavy-element interior",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/jupiter/jupiter-facts/",
  },
  saturn: {
    summary: "Mostly hydrogen and helium around a dense rock-and-ice core",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/saturn/facts/",
  },
  uranus: {
    summary:
      "Water, methane and ammonia-rich fluid above a rocky core, under hydrogen and helium",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/uranus/facts/",
  },
  neptune: {
    summary:
      "Water, methane and ammonia-rich fluid above a rocky core, under hydrogen and helium",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/neptune/neptune-facts/",
  },
  moon: {
    summary: "Silicate crust and mantle around a small, mostly iron core",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/moon/composition/",
  },
  phobos: {
    summary:
      "Dark, carbon-rich rocky material; its internal composition remains uncertain",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/mars/moons/facts/",
  },
  deimos: {
    summary:
      "Dark, carbon-rich rocky material; its internal composition remains uncertain",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/mars/moons/facts/",
  },
  io: {
    summary:
      "Silicate rock around an iron-rich core, with sulfur-rich volcanic deposits",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/jupiter/jupiter-moons/io/facts/",
  },
  europa: {
    summary:
      "Water-ice shell and salty ocean above a rocky mantle and iron core",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/jupiter/jupiter-moons/europa/facts/",
  },
  ganymede: {
    summary: "Iron core, rocky mantle, and layered water-ice shells and oceans",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/jupiter/jupiter-moons/ganymede/facts/",
  },
  callisto: {
    summary:
      "A mixture of rock and water ice, with a possible subsurface ocean",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/jupiter/jupiter-moons/callisto/facts/",
  },
  mimas: {
    summary: "Predominantly water ice with a smaller rocky component",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/saturn/moons/facts/",
  },
  enceladus: {
    summary: "Water-ice shell and global salty ocean around a rocky core",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/saturn/moons/enceladus/",
  },
  tethys: {
    summary: "Predominantly water ice with a smaller rocky component",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/saturn/moons/facts/",
  },
  dione: {
    summary: "Water ice mixed with rock, with evidence for a deep ocean",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/saturn/moons/facts/",
  },
  rhea: {
    summary: "Water ice mixed with rock",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/saturn/moons/facts/",
  },
  titan: {
    summary:
      "Water ice and rock beneath a nitrogen-rich atmosphere with methane",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/saturn/moons/titan/facts/",
  },
  iapetus: {
    summary: "Mostly water ice with rock and dark carbon-rich surface material",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/saturn/moons/facts/",
  },
  miranda: {
    summary: "Roughly equal parts water ice and rock",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/uranus/moons/facts/",
  },
  ariel: {
    summary: "Roughly equal parts water ice and rock",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/uranus/moons/facts/",
  },
  umbriel: {
    summary: "Roughly equal parts water ice and rock",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/uranus/moons/facts/",
  },
  titania: {
    summary: "Roughly equal parts water ice and rock",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/uranus/moons/facts/",
  },
  oberon: {
    summary: "Roughly equal parts water ice and rock",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/uranus/moons/facts/",
  },
  triton: {
    summary:
      "Rock and water ice, with nitrogen, methane and carbon-monoxide surface ices",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/neptune/moons/triton/",
  },
  pluto: {
    summary:
      "Rock and water ice, with nitrogen, methane and carbon-monoxide surface ices",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/dwarf-planets/pluto/facts/",
  },
  charon: {
    summary: "Rock and water ice, including exposed crystalline water ice",
    authority: NASA_SCIENCE,
    sourceUrl: "https://science.nasa.gov/dwarf-planets/pluto/moons/facts/",
  },
  iss: {
    summary:
      "Engineered pressurised modules, truss structure and photovoltaic arrays",
    authority: "NASA International Space Station Facts and Figures",
    sourceUrl:
      "https://www.nasa.gov/international-space-station/space-station-facts-and-figures/",
  },
  "voyager-1": {
    summary:
      "Engineered aluminium structure, high-gain antenna, radioisotope power systems and scientific instruments",
    authority: "NASA Voyager Frequently Asked Questions",
    sourceUrl:
      "https://science.nasa.gov/mission/voyager/frequently-asked-questions/",
  },
  "voyager-2": {
    summary:
      "Engineered aluminium structure, high-gain antenna, radioisotope power systems and scientific instruments",
    authority: "NASA Voyager Frequently Asked Questions",
    sourceUrl:
      "https://science.nasa.gov/mission/voyager/frequently-asked-questions/",
  },
  hubble: {
    summary:
      "Engineered aluminium structure, optical telescope assembly, solar arrays and scientific instruments",
    authority: "NASA Hubble Observatory Design",
    sourceUrl: "https://science.nasa.gov/mission/hubble/observatory/design/",
  },
  jwst: {
    summary:
      "Beryllium mirror segments, graphite composite structure, multilayer polymer sunshield and scientific instruments",
    authority: "NASA Webb Telescope Overview",
    sourceUrl: "https://science.nasa.gov/mission/webb/spacecraft/",
  },
  roadster: {
    summary:
      "Production electric sports car, spacesuit-wearing mannequin, payload fitting and attached Falcon Heavy upper stage",
    authority: "NASA/JPL Horizons Tesla Roadster solution 11",
    sourceUrl: "https://ssd.jpl.nasa.gov/horizons/news.html",
  },
};

const SUPERSCRIPT_DIGIT: Readonly<Record<string, string>> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

function superscript(value: number): string {
  return String(value)
    .split("")
    .map((character) => SUPERSCRIPT_DIGIT[character])
    .join("");
}

export function formatMassKg(massKg: number | undefined): string {
  if (massKg === undefined) {
    return "Not provided by source";
  }
  if (massKg < 1_000_000) {
    return `${massKg.toLocaleString("en-GB")} kg`;
  }
  const exponent = Math.floor(Math.log10(massKg));
  const coefficient = massKg / 10 ** exponent;
  return `${coefficient.toLocaleString("en-GB", {
    maximumSignificantDigits: 5,
  })} × 10${superscript(exponent)} kg`;
}
