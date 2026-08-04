# Solar System Time Explorer

Solar System Time Explorer is a browser-first scientific 3D application driven by numerical physics rather than scripted orbital animation.

REBOUND 5.0.0 supplies the N-body solver as WebAssembly.
The solver runs in a Web Worker and the TypeScript renderer consumes immutable solver states.
The present snapshot contains 31 massive bodies and all 459 records in the current NASA/JPL Horizons planetary-satellite index, plus 1,558,140 asteroid and comet records from NASA/JPL SBDB.
Of the indexed satellites, 458 have a state vector at the common epoch: 21 major moons remain active massive REBOUND bodies and 437 smaller moons use a reversible parent-centred two-body propagator around each live REBOUND parent state.
Daphnis is retained as explicitly unavailable because its published JPL trajectory ends in 2018.
WebGPU propagates 1,556,349 usable small-body orbital solutions in parallel and retains 1,791 incomplete records as explicitly unavailable.
WebGPU evaluates the complete small-body field and rasterizes deterministic zoom-dependent, category-aware density samples into a bounded target.
Each enabled category retains at least 1,024 catalogue records before camera-frustum filtering, preventing the much smaller comet catalogue from disappearing under the asteroid sampling rate.
Orrery wide views deliberately omit most unresolved positions and lower point exposure; approaching the system reveals progressively more catalogue positions.
Tan and cyan encode asteroid and comet categories and are explicitly not presented as measured surface colours.
The browser presents that bounded target directly through WebGPU without recurring texture readback or CPU pixel scans.

The optional gravity field evaluates the combined Newtonian potential from every current positive-GM body as `Φ = -Σ GM / r`.
Sampling is capped at each body's sourced mean-radius surface because the point-mass equation is not a valid interior-density model and would otherwise diverge at the centre.
The ecliptic-plane contour view and perspective surface use the same live positions and gravitational parameters as the simulation.
A WebGL vertex shader evaluates the field across the display mesh, while logarithmic colour and depth compression reveal the large dynamic range without feeding any display transformation back into the solver.
The three-dimensional funnel is an energy-landscape visualization, not a claim that Newtonian gravity literally bends a sheet or a representation of relativistic spacetime curvature.

The camera supports orbit, pan, continuous 0.5x to 8x optical zoom, named-body focus, continuous tracking, and one-action view reset.
An always-visible camera dock provides Back, Zoom out, Zoom in, Fit, Home, and a guided scale tour.
Each tour change uses a slow logarithmic-distance journey through the smallest useful context view, holds that overview long enough to establish location, and then settles into the next composition.
Earth-to-Moon and planet-to-moon moves remain inside their local system, while interplanetary moves reveal only the wider scale they need.
Every guided scene remains on screen for sixteen seconds, including a seven-and-a-half-second camera journey, and selects a forward simulation rate that makes the relevant rotation or orbital motion visible.
Pausing the tour pauses the physics clock.
Physics-anchored observer scenes select Mars, Io, Jupiter, or Titan as the view origin, place the camera above that body's physical radius, and continuously point it toward the live target body.
Breadcrumbs, selected-body data, transition framing, and Sun distance remain anchored to the observer rather than switching to the look-at target.
These are clear-space orbital viewpoints rather than invented terrain or atmospheric panoramas, and any optical zoom or physical sub-pixel limit is disclosed in the tour card.
Every guided scene keeps body radii physical; the tour never inflates moons or planets with Orrery sizing.
Focusing an object now uses a true 1× fit instead of silently applying additional optical magnification.
Orientation presets provide perspective, J2000 ecliptic overhead, ecliptic edge-on, parent-facing, velocity-following, and instantaneous orbital-plane views.
Reality view uses sourced physical radii on the same scale as body separation and draws no geometry below one CSS pixel in diameter.
Objects without installed radii, including catalogue-only moons and the asteroid and comet snapshot, do not receive false one-pixel markers in Reality.
Orrery view provides the continuous body-size boost, readable markers, and instantaneous osculating orbit guides derived from the current solver position and velocity, while Map view uses logarithmic spacing and retains each body's live orbital phase.
The tactical overlay derives adaptive distance rings, parent direction, velocity direction, and ecliptic-plane offset from the current physical state.
Semantic zoom changes label density and unit precision as the camera moves from the complete Solar System into a planetary, moon, or surface-scale view.
Collision-aware labels retain all overview planets and move overlapping labels onto nearby leader lines rather than hiding the body or inflating it into a false large sphere.
The time controls support paused, stepped, and continuous forward or backward integration from one second per real second through one simulated year per real second.
The explorer starts at one simulated hour per real second so surface rotation remains visually traceable; Pause freezes orbital and rotational state together.
Playback rate is independent of solver keyframe size: continuous playback integrates one simulated day or less per REBOUND endpoint and uses velocity-constrained Hermite interpolation only between completed states.
REBOUND double-buffers batches in its Worker while the current batch is displayed.
If rendering falls behind, the clock advances to the newest due exact endpoint while every skipped display endpoint still contributes to the trails; the toolbar reports requested and measured achieved rates separately.
The Orrery body-size control continuously and geometrically interpolates between true physical radii and a disclosed maximum-readable transformation.
It also caps enhanced radii against the nearest major-body separation, preventing a readability setting from merging neighboring bodies.

The International Space Station is a separate massless spacecraft state around the live REBOUND Earth position.
Its installed CelesTrak Orbit Mean-Elements Message is propagated with SGP4 in UTC, transformed from TEME through true equator of date into the J2000 mean-equator frame, and then translated by Earth's barycentric state.
Selecting the ISS seeks to the installed 2 August 2026 element epoch because the Solar System snapshot begins on 1 January 2026.
The station is not drawn outside the declared seven-day element window.
Its procedural shape preserves NASA's 109 metre maximum end-to-end dimension and 73 metre solar-array dimension on the same physical scale as its orbit, so it disappears below one pixel from an Earth-system view and becomes visible only from a close spacecraft focus.

Major-body rotation uses the complete NAIF PCK pole, nutation, and prime-meridian model for each installed body.
ICRF positions and body axes are transformed into the Three.js y-up scene with a right-handed basis, and the WebGPU small-body path uses the same transform.
Surface presentation uses 32 locally snapshotted NASA, JPL, and USGS image assets with explicit source URLs, source and output dimensions, coverage, projection, limitations, byte lengths, and SHA-256 hashes.
Twenty-nine colour maps cover every non-stellar major body except Uranus, while separate Earth-cloud and Moon-topography products provide auxiliary detail.
Mercury uses the USGS 23,040 by 11,520 pixel MESSENGER end-of-mission global colour mosaic, while Pluto uses the 24,888 by 12,444 pixel USGS/New Horizons observational mosaic; both are reduced to 4,096 pixels for a bounded browser GPU footprint.
The Moon, Ganymede, Enceladus, and Charon also use authority masters reduced to the same browser limit.
Saturn uses the 3,601 by 1,801 pixel Cassini ISS global RGB atmosphere map from NASA's Planetary Data System, with unobserved regions feather-filled from the separately declared NASA visualization rather than left black.
Its globe preserves the measured equatorial and polar radii, while its main rings use a natural-colour Cassini radial mosaic covering 74,565 to 136,780 kilometres from Saturn's centre instead of generated sine-wave bands.
Uranus has no solid visible surface and no complete contemporaneous global cloud map, so it uses a Voyager-constrained atmosphere colour instead of fictional terrain.
Coverage-filled, reconstructed, unobserved, enhanced-colour, and visualization regions remain explicit in the manifest rather than being presented as uniformly measured imagery.
Planet surfaces use Sun-position point lighting, and atmosphere rims use a view-dependent Fresnel shader.
The Sun combines a granular procedural photosphere, subtle chromosphere rim, and restrained diffuse corona.
The renderer does not invent prominence or flare geometry because no generic animation can truthfully claim the Sun's actual activity at arbitrary simulation times.
Uranus uses procedurally banded ring opacity where a comparable installed observation profile is not available.
The background contains 8,789 stars from the ESA Hipparcos catalogue with Johnson V magnitude below 6.5.
Catalogue ICRS positions are propagated from J1991.25 to the simulation date using the published proper-motion components where both are available, while missing motion remains explicitly unknown and fixed at the catalogue epoch.
Point prominence is derived from Johnson V magnitude in CSS pixels so high-density displays do not reduce stars to invisible subpixels, display colour is approximated from the measured B-V index, and the complete star layer can be switched off independently.

The application generates an original ethereal ambient composition locally with the Web Audio API, using slowly changing harmony, filtered pad voices, delay, and sparse chimes rather than a licensed loop.
Browser autoplay rules keep the application silent until the first interaction.
Ambient music and interface feedback have independent enable and volume controls, persist within local browser storage, and suspend while the page is hidden.

## Prerequisites

- Node.js 24 or newer
- pnpm 11.18.0
- Docker Desktop for the pinned Emscripten build container

## Setup

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm wasm:build
pnpm data:horizons
pnpm data:horizons-satellites
pnpm data:sbdb
pnpm data:naif
pnpm data:nasa-assets
pnpm data:stars
pnpm data:horizons-regression
pnpm complete
pnpm dev
```

The data commands refresh authority snapshots and therefore require network access.
They are not required for an ordinary build because validated snapshots and assets are committed locally.

Open the URL printed by Vite.

## Verification

`pnpm complete` checks formatting, lint, documentation, strict types, 77 unit tests, the production build, a numerical WebAssembly invariant test, a permanent NASA/JPL Horizons regression, and thirteen real installed-Chrome interaction journeys.
The smoke test integrates a Sun-Earth system through one calculated orbital period and checks the final separation and energy error.
The Horizons regression compares integrated Earth-Sun and Moon-Earth separation against seven fixed authority reference states from -365 through +365 days.
The current maximum errors are 60,961.474 m for Earth-Sun and 13,743.411 m for Moon-Earth after one year, within the checked 100 km and 20 km bounds.
The browser test verifies that the rendered solver state loads and that the REBOUND worker advances simulated time through the user control.
It validates representative elliptic and hyperbolic GPU positions against an independent CPU authority model, samples finite positions, and checks an offscreen render before the layer becomes ready.
It then captures the directly presented Orrery small-body canvas through the browser compositor, failing unless catalogue-coloured pixels are actually visible, and verifies the independent planet, moon, asteroid, and comet filters, camera rotation, zoom-dependent level of detail, micro-to-macro time-step selection, forward and backward integration, and both endpoints of the continuous Orrery body-size boost.
The audio journey exercises the native browser audio context, verifies feedback oscillator creation for mouse and keyboard controls, and checks audio preference restoration after reload.
The gravity-field journey verifies positive-GM superposition, sourced-radius surface capping, physical joules-per-kilogram diagnostics, contour and surface rendering, local focus scaling, and synchronization with simulation time.

The Display panel independently filters planets and dwarf planets, moons, spacecraft, asteroids, comets, and catalogue stars.
The same panel independently controls ambient music, interface feedback, and their volume levels.
The initial Reality overview uses physical scale, so labels identify bodies whose geometry is too small to resolve without turning them into false visible pixels.
Asteroid and comet locator layers are available only in Orrery.
The Sun remains visible as the reference origin even when every category is hidden.
Every focused view adds a clickable Sun bearing with the live physics-derived separation; off-screen and behind-camera directions pin to a safe viewport edge without overlapping the main controls.

The searchable Focus control can focus and continuously track any available major body or installed moon.
Double-clicking a rendered major body focuses it, while Back, Home, Parent, and Next planet provide explicit navigation paths.
Focusing the Sun preserves the full-system 90 AU framing while centring the heliocentric reference body.
Focusing Earth fits Earth itself; the separate Earth-Moon tour shot frames their real separation explicitly.
Reality starts with trails, orbit guides, the tactical overlay, the ecliptic grid, and gravity surfaces off so the physical scene is not obscured by unexplained lines.
The optional Moon and planet trails contain only exact physics endpoint samples.
Trails can be viewed in heliocentric, Solar System barycentric, or body-parent-relative frames, making inertial motion and local orbital motion directly comparable without decorative orbit curves.
Trail length and fading are adjustable, and Clear trails removes all accumulated history immediately.
The optional Orrery minor-body trail uses fading screen-space history of actual GPU-propagated catalogue positions, resets when the camera changes, and applies to whichever asteroid and comet categories are visible.
Selecting a planet starts with a fitted 1x parent-facing view so its complete body or ring system remains legible; the ordinary zoom and orientation controls remain available.
The selected-object card reports source-snapshot mass, sourced bulk composition, and names the parent used as the velocity reference, such as "Speed relative to Sun" for Earth and "Speed relative to Earth" for the Moon.
When the installed Horizons satellite catalogue does not provide mass or composition, the card says so explicitly rather than substituting an estimate.
Reset or the `R` key restores a known parent-facing body view when navigation becomes disorienting.
The camera dock remains visible at narrow widths, and Fit always restores the selected object's intended framing after wheel, pinch, or optical zoom.
The six-step Scale of the Solar System tour moves from a close Earth shot through the Earth-Moon gap, Jupiter, Saturn, Neptune, and the complete 90 AU physical view.
Each step owns its camera distance, orientation, view mode, body-size treatment, and overlay set; any orbital guide it enables is named in the tour card.
The tour can auto-advance, pause, resume after manual camera control, move step by step, or exit without changing the physics model.

## Documentation

- [Requirements specification](docs/specs/solar-system-time-explorer-spec.md)
- [Testable requirements matrix](docs/specs/solar-system-time-explorer-test-matrix.md)
- [Specification changelog](docs/specs/solar-system-time-explorer-changelog.md)

## Scientific boundary

Rendered body positions will originate from numerical integration of explicit initial conditions and force models.

Authoritative ephemerides provide initial states and validation references, not frame-by-frame scripted trajectories.

Deep-time scenarios require explicit physical assumptions and uncertainty disclosure because present-day measurements cannot determine unique states billions of years into the past or future.

The current executable is the present-day propagated scenario.
It installs every entry in the current JPL planetary-satellite index, but not the more than 470 additional confirmed companions orbiting asteroids, trans-Neptunian objects, and other dwarf planets that are outside that index.
It does not yet install a cited Solar System formation model, a time-dependent solar-evolution model, or every authority-recognized dwarf planet as an active massive body.
Those states remain unavailable instead of being improvised from present-day trajectories.

The 437 small installed moons are massless reversible two-body solutions around their live REBOUND parent state.
They do not include mutual or planetary perturbations and are disclosed as a lower-detail physical model.

The ISS uses an authority snapshot rather than a live network request so every run is reproducible.
SGP4 includes the perturbation and drag terms encoded by the OMM, but the installed element solution is intentionally treated as unavailable more than seven days from its epoch.
The procedural station geometry is dimensionally scaled and oriented to the instantaneous local orbital frame; it is not an attitude-telemetry reconstruction or a detailed engineering model.

Small bodies currently use a declared Sun-centred two-body Kepler model on the GPU.
They do not yet receive planetary perturbations or perturb the massive REBOUND system.

The star layer is astrometric within the installed Hipparcos data and its linear proper-motion model, but point size, opacity, and B-V colour mapping are perceptual rendering treatments rather than calibrated photometry.
Atmosphere, corona, and ring-band shaders are disclosed rendering treatments rather than new measured surface data.
Inter-body eclipse shadows are not yet modelled; the current lighting accurately supplies Sun-facing illumination and day-night terminators but does not claim occultation shadows.
The gravity overlay is Newtonian potential on a two-dimensional J2000 ecliptic-parallel slice.
Its logarithmic contours and rendered depth are perceptual mappings of calculated potential, not additional forces, physical deformation, or general-relativistic curvature.
Perspective depth is capped at 3.2 percent of the field extent so the visual well remains attached to the orbital slice instead of appearing detached from its source body.

## Licensing

This project and its REBOUND-linked WebAssembly distribution are licensed under GPL-3.0.
The pinned REBOUND source and its license are included under `vendor/rebound/`.
The MIT-licensed satellite.js and Astronomy Engine dependencies supply SGP4 and celestial-frame rotation respectively; their exact versions and integrity hashes are locked in `pnpm-lock.yaml`.
