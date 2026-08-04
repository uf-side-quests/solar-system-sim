import { describe, expect, it } from "vitest";

import type { ObjectVisibility } from "./visibility";
import { DEFAULT_OBJECT_VISIBILITY, isMajorBodyVisible } from "./visibility";

const nothingVisible: ObjectVisibility = {
  planets: false,
  moons: false,
  asteroids: false,
  comets: false,
  stars: false,
  spacecraft: false,
};

describe("major-body category visibility", () => {
  it("starts with a clear major-body view", () => {
    expect(DEFAULT_OBJECT_VISIBILITY).toEqual({
      planets: true,
      moons: true,
      asteroids: false,
      comets: false,
      stars: true,
      spacecraft: true,
    });
  });

  it("keeps the Sun visible as the reference origin", () => {
    expect(isMajorBodyVisible("star", nothingVisible)).toBe(true);
  });

  it("groups planets and dwarf planets under the planet control", () => {
    const visibility = { ...nothingVisible, planets: true };

    expect(isMajorBodyVisible("planet", visibility)).toBe(true);
    expect(isMajorBodyVisible("dwarf-planet", visibility)).toBe(true);
    expect(isMajorBodyVisible("moon", visibility)).toBe(false);
  });

  it("controls moons independently", () => {
    const visibility = { ...nothingVisible, moons: true };

    expect(isMajorBodyVisible("planet", visibility)).toBe(false);
    expect(isMajorBodyVisible("dwarf-planet", visibility)).toBe(false);
    expect(isMajorBodyVisible("moon", visibility)).toBe(true);
  });
});
