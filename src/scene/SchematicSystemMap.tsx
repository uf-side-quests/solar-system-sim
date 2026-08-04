import type { CSSProperties } from "react";

import type { SimulationState } from "../physics/contracts";
import {
  ISS_BODY_ID,
  ISS_PARENT_BODY_ID,
  isIssEphemerisWithinValidity,
} from "../physics/iss-ephemeris";
import {
  additionalAvailableKnownSatellites,
  knownSatelliteById,
} from "../physics/known-satellites";
import {
  ASTRONOMICAL_UNIT_M,
  majorBodySnapshot,
} from "../physics/solar-system";
import { PARENT_BODY_ID } from "./body-facts";
import type { ObjectVisibility } from "./visibility";

type SchematicSystemMapProps = Readonly<{
  state: SimulationState | undefined;
  focusBodyId: string;
  objectVisibility: ObjectVisibility;
  onFocusBody(bodyId: string): void;
}>;

type PositionedBody = Readonly<{
  id: string;
  name: string;
  type: "star" | "planet" | "dwarf-planet" | "moon";
  xPercent: number;
  yPercent: number;
  orbitRadiusPercent: number;
  catalogueMoon?: boolean;
  spacecraft?: boolean;
}>;

function logarithmicOrbitRadiusPercent(distanceAu: number): number {
  const minimumLogDistance = Math.log10(0.3);
  const maximumLogDistance = Math.log10(50);
  const fraction = Math.min(
    1,
    Math.max(
      0,
      (Math.log10(Math.max(distanceAu, 0.3)) - minimumLogDistance) /
        (maximumLogDistance - minimumLogDistance),
    ),
  );
  return 10 + fraction * 36;
}

export function SchematicSystemMap({
  state,
  focusBodyId,
  objectVisibility,
  onFocusBody,
}: SchematicSystemMapProps) {
  const sunState = state?.bodies.find((body) => body.id === "sun");
  const planetDefinitions = majorBodySnapshot.bodies.filter(
    (body) => body.type === "planet" || body.type === "dwarf-planet",
  );
  const positionedPlanets: PositionedBody[] = [];
  if (state !== undefined && sunState !== undefined) {
    for (const definition of planetDefinitions) {
      const body = state.bodies.find(
        (candidate) => candidate.id === definition.id,
      );
      if (body === undefined) {
        continue;
      }
      const relativeX = body.positionM[0] - sunState.positionM[0];
      const relativeY = body.positionM[1] - sunState.positionM[1];
      const relativeZ = body.positionM[2] - sunState.positionM[2];
      const distanceAu =
        Math.hypot(relativeX, relativeY, relativeZ) / ASTRONOMICAL_UNIT_M;
      const angle = Math.atan2(relativeY, relativeX);
      const orbitRadiusPercent = logarithmicOrbitRadiusPercent(distanceAu);
      positionedPlanets.push({
        id: definition.id,
        name: definition.name,
        type: definition.type,
        xPercent: 50 + Math.cos(angle) * orbitRadiusPercent,
        yPercent: 50 + Math.sin(angle) * orbitRadiusPercent,
        orbitRadiusPercent,
      });
    }
  }

  const focusedDefinition = majorBodySnapshot.bodies.find(
    (body) => body.id === focusBodyId,
  );
  const focusedKnownSatellite = knownSatelliteById.get(focusBodyId);
  const focusedSystemId =
    focusBodyId === ISS_BODY_ID
      ? ISS_PARENT_BODY_ID
      : focusedKnownSatellite !== undefined
        ? focusedKnownSatellite.parentId
        : focusedDefinition?.type === "moon"
          ? PARENT_BODY_ID[focusedDefinition.id]
          : focusedDefinition?.type === "planet" ||
              focusedDefinition?.type === "dwarf-planet"
            ? focusedDefinition.id
            : undefined;
  const focusedSystemPosition = positionedPlanets.find(
    (body) => body.id === focusedSystemId,
  );
  const positionedMoons: PositionedBody[] = [];
  if (
    state !== undefined &&
    focusedSystemId !== undefined &&
    focusedSystemPosition !== undefined &&
    (objectVisibility.moons || objectVisibility.spacecraft)
  ) {
    const parent = state.bodies.find((body) => body.id === focusedSystemId);
    const majorMoons = majorBodySnapshot.bodies.filter(
      (body) =>
        body.type === "moon" && PARENT_BODY_ID[body.id] === focusedSystemId,
    );
    const catalogueMoons = additionalAvailableKnownSatellites.filter(
      (body) => body.parentId === focusedSystemId,
    );
    const moons = [
      ...majorMoons
        .filter(() => objectVisibility.moons)
        .map((body) => ({
          id: body.id,
          name: body.name,
          catalogueMoon: false,
          spacecraft: false,
        })),
      ...catalogueMoons
        .filter(() => objectVisibility.moons)
        .map((body) => ({
          id: body.id,
          name: body.name,
          catalogueMoon: true,
          spacecraft: false,
        })),
      ...(focusedSystemId === ISS_PARENT_BODY_ID &&
      objectVisibility.spacecraft &&
      isIssEphemerisWithinValidity(state.timeSeconds)
        ? [
            {
              id: ISS_BODY_ID,
              name: "ISS",
              catalogueMoon: false,
              spacecraft: true,
            },
          ]
        : []),
    ];
    if (parent !== undefined) {
      const moonStates = moons.flatMap((definition) => {
        const body = state.bodies.find(
          (candidate) => candidate.id === definition.id,
        );
        if (body === undefined) {
          return [];
        }
        return [
          {
            definition,
            body,
            distance: Math.hypot(
              body.positionM[0] - parent.positionM[0],
              body.positionM[1] - parent.positionM[1],
              body.positionM[2] - parent.positionM[2],
            ),
          },
        ];
      });
      const minimumDistance = Math.min(
        ...moonStates.map((moon) => moon.distance),
      );
      const maximumDistance = Math.max(
        ...moonStates.map((moon) => moon.distance),
      );
      const logarithmicSpan = Math.max(
        1e-9,
        Math.log10(maximumDistance) - Math.log10(minimumDistance),
      );
      for (const { definition, body, distance } of moonStates) {
        const angle = Math.atan2(
          body.positionM[1] - parent.positionM[1],
          body.positionM[0] - parent.positionM[0],
        );
        const moonRadiusPercent =
          2.2 +
          ((Math.log10(distance) - Math.log10(minimumDistance)) /
            logarithmicSpan) *
            6.8;
        positionedMoons.push({
          id: definition.id,
          name: definition.name,
          type: "moon",
          xPercent:
            focusedSystemPosition.xPercent +
            Math.cos(angle) * moonRadiusPercent,
          yPercent:
            focusedSystemPosition.yPercent +
            Math.sin(angle) * moonRadiusPercent,
          orbitRadiusPercent: moonRadiusPercent,
          catalogueMoon: definition.catalogueMoon,
          spacecraft: definition.spacecraft,
        });
      }
    }
  }

  const bodyButton = (body: PositionedBody) => (
    <button
      key={body.id}
      type="button"
      className={`schematic-body schematic-${body.type}${body.catalogueMoon ? " is-catalogue-moon" : ""}${body.spacecraft ? " is-spacecraft" : ""}${focusBodyId === body.id ? " is-selected" : ""}`}
      style={
        {
          "--schematic-x": `${String(body.xPercent)}%`,
          "--schematic-y": `${String(body.yPercent)}%`,
        } as CSSProperties
      }
      aria-pressed={focusBodyId === body.id}
      onClick={() => onFocusBody(body.id)}
    >
      <span className="schematic-dot" aria-hidden="true" />
      <span>{body.name}</span>
    </button>
  );

  return (
    <section
      className="schematic-map"
      role="region"
      aria-label="Schematic Solar System map using live physics positions and logarithmic orbital spacing"
      data-view-mode="schematic"
    >
      <div className="schematic-map-note">
        Live positions · logarithmic spacing
      </div>
      <svg
        className="schematic-orbits"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        {positionedPlanets.map((body) => (
          <circle
            key={body.id}
            cx="50"
            cy="50"
            r={body.orbitRadiusPercent}
            className={focusBodyId === body.id ? "is-selected" : undefined}
          />
        ))}
        {positionedMoons
          .filter((body) => !body.catalogueMoon || body.id === focusBodyId)
          .map((body) => (
            <circle
              key={body.id}
              cx={focusedSystemPosition?.xPercent}
              cy={focusedSystemPosition?.yPercent}
              r={body.orbitRadiusPercent}
              className="moon-orbit"
            />
          ))}
      </svg>
      <button
        type="button"
        className={`schematic-body schematic-star${focusBodyId === "sun" ? " is-selected" : ""}`}
        style={
          {
            "--schematic-x": "50%",
            "--schematic-y": "50%",
          } as CSSProperties
        }
        aria-pressed={focusBodyId === "sun"}
        onClick={() => onFocusBody("sun")}
      >
        <span className="schematic-dot" aria-hidden="true" />
        <span>Sun</span>
      </button>
      {objectVisibility.planets ? positionedPlanets.map(bodyButton) : null}
      {positionedMoons.map(bodyButton)}
    </section>
  );
}
