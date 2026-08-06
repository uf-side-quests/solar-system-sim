export const ALPHA_CENTAURI_DISTANCE_LIGHT_YEARS = 4.3;
export const ALPHA_CENTAURI_DISTANCE_AU = 272_000;
export const SOLAR_SYSTEM_TOUR_VIEW_AU = 220;
export const OORT_CLOUD_OUTER_ESTIMATE_AU = 100_000;
export const NEPTUNE_DISTANCE_AU = 30;
export const VOYAGER_2_DISTANCE_AU = 140;
export const VOYAGER_1_DISTANCE_AU = 166;

export const SOLAR_SYSTEM_SHARE_OF_ALPHA_DISTANCE_PERCENT =
  (SOLAR_SYSTEM_TOUR_VIEW_AU / ALPHA_CENTAURI_DISTANCE_AU) * 100;
export const OORT_CLOUD_SHARE_OF_ALPHA_DISTANCE_PERCENT =
  (OORT_CLOUD_OUTER_ESTIMATE_AU / ALPHA_CENTAURI_DISTANCE_AU) * 100;

function insetPosition(distanceAu: number): string {
  return `${String((distanceAu / SOLAR_SYSTEM_TOUR_VIEW_AU) * 100)}%`;
}

export function InterstellarScaleScene({
  playing,
}: Readonly<{ playing: boolean }>) {
  return (
    <section
      className={`interstellar-scale-scene${playing ? " is-playing" : ""}`}
      aria-label="Physical distance from the Sun to Alpha Centauri"
      data-alpha-distance-light-years={ALPHA_CENTAURI_DISTANCE_LIGHT_YEARS}
      data-alpha-distance-au={ALPHA_CENTAURI_DISTANCE_AU}
      data-solar-system-share-percent={
        SOLAR_SYSTEM_SHARE_OF_ALPHA_DISTANCE_PERCENT
      }
      data-oort-cloud-share-percent={OORT_CLOUD_SHARE_OF_ALPHA_DISTANCE_PERCENT}
    >
      <div className="interstellar-scale-heading">
        <span>Linear distance at physical proportion</span>
        <strong>
          Even a 100,000 AU Oort Cloud estimate spans only about 37%
        </strong>
      </div>

      <div className="interstellar-distance-line" aria-hidden="true">
        <span
          className="interstellar-oort-range"
          style={{
            width: `${String(OORT_CLOUD_SHARE_OF_ALPHA_DISTANCE_PERCENT)}%`,
          }}
        />
        <span className="interstellar-light-pulse" />
        <span className="interstellar-origin-mark" />
        <span className="interstellar-destination-mark" />
      </div>
      <div
        className="interstellar-oort-label"
        style={{
          left: `${String(OORT_CLOUD_SHARE_OF_ALPHA_DISTANCE_PERCENT)}%`,
        }}
      >
        possible Oort Cloud edge · 100,000 AU
      </div>
      <div className="interstellar-endpoints">
        <span>
          <strong>Sun</strong>
          <small>0 AU</small>
        </span>
        <span>
          <strong>Alpha Centauri system</strong>
          <small>4.3 light-years · about 272,000 AU</small>
        </span>
      </div>

      <div className="interstellar-origin-inset">
        <div className="interstellar-inset-heading">
          <span>First 220 AU magnified about 1,236 times</span>
          <small>The planets, heliopause, and both Voyagers</small>
        </div>
        <div className="interstellar-inset-line" aria-hidden="true">
          <span className="inset-sun" style={{ left: "0%" }} />
          <span
            className="inset-neptune"
            style={{ left: insetPosition(NEPTUNE_DISTANCE_AU) }}
          />
          <span
            className="inset-voyager-2"
            style={{ left: insetPosition(VOYAGER_2_DISTANCE_AU) }}
          />
          <span
            className="inset-voyager-1"
            style={{ left: insetPosition(VOYAGER_1_DISTANCE_AU) }}
          />
          <span className="inset-limit" style={{ left: "100%" }} />
        </div>
        <div className="interstellar-inset-labels">
          <span style={{ left: "0%" }}>Sun</span>
          <span style={{ left: insetPosition(NEPTUNE_DISTANCE_AU) }}>
            Neptune · 30 AU
          </span>
          <span style={{ left: insetPosition(VOYAGER_2_DISTANCE_AU) }}>
            Voyager 2
          </span>
          <span style={{ left: insetPosition(VOYAGER_1_DISTANCE_AU) }}>
            Voyager 1
          </span>
          <span style={{ left: "100%" }}>220 AU</span>
        </div>
      </div>

      <p className="interstellar-scale-disclosure">
        This is a sourced linear scale diagram, not an extension of the live
        Solar System gravity simulation. The Oort Cloud edge is an estimate; the
        animated pulse compresses a 4.3-year light journey into the scene.
      </p>
    </section>
  );
}
