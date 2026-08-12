import { AstroTime } from "astronomy-engine";

import { majorBodySnapshot } from "./solar-system";

const J2000_JULIAN_DAY = 2_451_545;
const SECONDS_PER_DAY = 86_400;

export function simulationDateUtc(timeSeconds: number): Date {
  if (!Number.isFinite(timeSeconds)) {
    throw new Error("Simulation time must be finite");
  }
  const epochTerrestrialDays = majorBodySnapshot.epoch.value - J2000_JULIAN_DAY;
  return AstroTime.FromTerrestrialTime(
    epochTerrestrialDays + timeSeconds / SECONDS_PER_DAY,
  ).date;
}

export function formatSimulationDateUtc(timeSeconds: number): string {
  const date = simulationDateUtc(timeSeconds);
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = date.toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");
  return `${day} ${month} ${String(year)} · ${hours}:${minutes}:${seconds} UTC`;
}
