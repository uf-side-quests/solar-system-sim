const HELIOPAUSE_VOYAGER_1_AU = 122;
const HELIOPAUSE_VOYAGER_2_AU = 119;
const TERMINATION_SHOCK_VOYAGER_1_AU = 94;
const TERMINATION_SHOCK_VOYAGER_2_AU = 84;
const VOYAGER_1_DISTANCE_AU = 166;
const VOYAGER_2_DISTANCE_AU = 140;

export const OORT_CLOUD_INNER_EDGE_MIN_AU = 2_000;
export const OORT_CLOUD_INNER_EDGE_MAX_AU = 5_000;
export const OORT_CLOUD_OUTER_EDGE_MIN_AU = 10_000;
export const OORT_CLOUD_OUTER_EDGE_MAX_AU = 100_000;
export const ALPHA_CENTAURI_COMPARISON_AU = 272_000;

export type OuterRegionPresentation = "heliosphere" | "oort-cloud";

const OORT_SHELL_RADIUS = 268;
const OORT_SHELL_INNER_RADIUS =
  (OORT_CLOUD_INNER_EDGE_MIN_AU / OORT_CLOUD_OUTER_EDGE_MAX_AU) *
  OORT_SHELL_RADIUS;
const OORT_POINT_COUNT = 420;

const OORT_POINTS = Array.from({ length: OORT_POINT_COUNT }, (_, index) => {
  const angle = ((index * 137.507_764_05) / 180) * Math.PI;
  const normalizedRadius = Math.sqrt((index + 0.5) / OORT_POINT_COUNT);
  const radius =
    OORT_SHELL_INNER_RADIUS +
    normalizedRadius * (OORT_SHELL_RADIUS - OORT_SHELL_INNER_RADIUS);
  return {
    x: 310 + Math.cos(angle) * radius,
    y: 310 + Math.sin(angle) * radius,
    opacity: 0.18 + ((index * 29) % 60) / 100,
    radius: 0.65 + ((index * 17) % 8) / 10,
  };
});

function percentage(value: number, maximum: number): string {
  return `${String((value / maximum) * 100)}%`;
}

function HeliosphereDiagram() {
  return (
    <section
      className="outer-region-scene heliosphere-scale-scene"
      aria-label="Heliosphere and Voyager boundary crossings"
      data-heliopause-voyager-1-au={HELIOPAUSE_VOYAGER_1_AU}
      data-heliopause-voyager-2-au={HELIOPAUSE_VOYAGER_2_AU}
      data-termination-shock-voyager-1-au={TERMINATION_SHOCK_VOYAGER_1_AU}
      data-termination-shock-voyager-2-au={TERMINATION_SHOCK_VOYAGER_2_AU}
      data-voyager-1-distance-au={VOYAGER_1_DISTANCE_AU}
      data-voyager-2-distance-au={VOYAGER_2_DISTANCE_AU}
      data-boundary-model="direction-dependent-scale-diagram"
    >
      <header className="outer-region-heading">
        <span>The Sun changes the space around it</span>
        <strong>The heliosphere is a bubble made by the solar wind</strong>
      </header>

      <div className="heliosphere-visual">
        <svg viewBox="0 0 1200 700" role="presentation">
          <defs>
            <radialGradient id="heliosphere-fill">
              <stop offset="0" stopColor="#f7b95a" stopOpacity="0.2" />
              <stop offset="0.58" stopColor="#55bdec" stopOpacity="0.12" />
              <stop offset="1" stopColor="#4aa6db" stopOpacity="0.025" />
            </radialGradient>
            <filter id="sun-halo">
              <feGaussianBlur stdDeviation="12" />
            </filter>
          </defs>
          <ellipse
            className="heliosphere-bubble"
            cx="600"
            cy="350"
            rx="286"
            ry="238"
          />
          <ellipse
            className="termination-shock-boundary"
            cx="600"
            cy="350"
            rx="211"
            ry="176"
          />
          <circle className="heliosphere-sun-halo" cx="600" cy="350" r="35" />
          <circle className="heliosphere-sun" cx="600" cy="350" r="8" />
          <path
            className="voyager-path voyager-one-path"
            d="M 600 350 L 1008 130"
          />
          <path
            className="voyager-path voyager-two-path"
            d="M 600 350 L 270 590"
          />
          <circle className="voyager-marker" cx="1008" cy="130" r="7" />
          <circle className="voyager-marker" cx="270" cy="590" r="7" />
          <text className="diagram-label sun-label" x="600" y="380">
            Sun
          </text>
          <text className="diagram-label boundary-label" x="600" y="98">
            Heliopause · about 119-122 AU along the Voyager paths
          </text>
          <text className="diagram-label shock-label" x="600" y="180">
            Termination shock · 84-94 AU along the Voyager paths
          </text>
          <text className="diagram-label voyager-one-label" x="1024" y="126">
            Voyager 1 · about 166 AU
          </text>
          <text className="diagram-label voyager-two-label" x="250" y="620">
            Voyager 2 · more than 140 AU
          </text>
        </svg>
      </div>

      <div className="outer-region-explanation">
        <p>
          <strong>Solar wind</strong>
          Electrically charged particles stream outward from the Sun.
        </p>
        <p>
          <strong>Termination shock</strong>
          The solar wind abruptly slows before reaching the outer boundary.
        </p>
        <p>
          <strong>Heliopause</strong>
          Solar wind pressure balances the interstellar medium. Beyond it is
          interstellar space.
        </p>
      </div>

      <p className="outer-region-disclosure">
        Distances use NASA Voyager measurements. The boundary is simplified for
        scale: the real heliosphere is asymmetric and changes with direction and
        solar activity.
      </p>
    </section>
  );
}

function OortCloudDiagram() {
  return (
    <section
      className="outer-region-scene oort-cloud-scale-scene"
      aria-label="Scale of the Oort Cloud"
      data-oort-inner-min-au={OORT_CLOUD_INNER_EDGE_MIN_AU}
      data-oort-inner-max-au={OORT_CLOUD_INNER_EDGE_MAX_AU}
      data-oort-outer-min-au={OORT_CLOUD_OUTER_EDGE_MIN_AU}
      data-oort-outer-max-au={OORT_CLOUD_OUTER_EDGE_MAX_AU}
    >
      <header className="outer-region-heading">
        <span>The Sun's distant gravitational domain</span>
        <strong>The Oort Cloud is vastly larger than the heliosphere</strong>
      </header>

      <div className="oort-layout">
        <div className="oort-shell-visual">
          <svg viewBox="0 0 620 620" role="presentation">
            <circle className="oort-outer-boundary" cx="310" cy="310" r="268" />
            <circle
              className="oort-inner-boundary"
              cx="310"
              cy="310"
              r="13.4"
            />
            {OORT_POINTS.map((point, index) => (
              <circle
                key={index}
                className="oort-object-mark"
                cx={point.x}
                cy={point.y}
                r={point.radius}
                opacity={point.opacity}
              />
            ))}
            <circle className="oort-sun" cx="310" cy="310" r="4" />
            <circle className="oort-previous-view" cx="310" cy="310" r="0.59" />
          </svg>
          <span className="oort-shell-label">
            Possible outer edge · 100,000 AU
          </span>
          <span className="oort-centre-label">
            Sun and the previous 220 AU view
          </span>
        </div>

        <div className="oort-scale-copy">
          <p>
            <strong>A predicted reservoir of long-period comets</strong>
            No spacecraft has reached it and its individual bodies have not been
            mapped. The points show the proposed shell, not catalogued objects.
          </p>
          <dl>
            <div>
              <dt>Inner edge</dt>
              <dd>roughly 2,000-5,000 AU</dd>
            </div>
            <div>
              <dt>Possible outer edge</dt>
              <dd>roughly 10,000-100,000 AU</dd>
            </div>
            <div>
              <dt>Voyager 1 arrival</dt>
              <dd>about 300 years to the inner edge at its present speed</dd>
            </div>
          </dl>
        </div>
      </div>

      <div
        className="oort-alpha-ruler"
        aria-label="Oort Cloud compared with Alpha Centauri"
      >
        <div className="oort-alpha-line" aria-hidden="true">
          <span className="oort-alpha-sun" style={{ left: "0%" }} />
          <span
            className="oort-alpha-inner"
            style={{
              left: percentage(
                OORT_CLOUD_INNER_EDGE_MIN_AU,
                ALPHA_CENTAURI_COMPARISON_AU,
              ),
            }}
          />
          <span
            className="oort-alpha-outer"
            style={{
              left: percentage(
                OORT_CLOUD_OUTER_EDGE_MAX_AU,
                ALPHA_CENTAURI_COMPARISON_AU,
              ),
            }}
          />
          <span className="oort-alpha-star" style={{ left: "100%" }} />
        </div>
        <div className="oort-alpha-labels">
          <span>Sun</span>
          <span
            style={{
              left: percentage(
                OORT_CLOUD_OUTER_EDGE_MAX_AU,
                ALPHA_CENTAURI_COMPARISON_AU,
              ),
            }}
          >
            Oort Cloud may reach 100,000 AU
          </span>
          <span>Alpha Centauri · 272,000 AU</span>
        </div>
      </div>
    </section>
  );
}

export function OuterRegionsScaleScene({
  presentation,
}: Readonly<{ presentation: OuterRegionPresentation }>) {
  return presentation === "heliosphere" ? (
    <HeliosphereDiagram />
  ) : (
    <OortCloudDiagram />
  );
}
