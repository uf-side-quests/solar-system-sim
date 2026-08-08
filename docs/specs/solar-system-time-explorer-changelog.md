# Solar System Time Explorer - Changelog

All notable changes to this specification are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and specification versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- **MAJOR**: Requirements are removed or changed incompatibly.
- **MINOR**: New requirements are added.
- **PATCH**: Informative text, wording, or formatting is clarified without changing behavior.

---

## [2.7.2] - 2026-08-08

### Changed in 2.7.2

- Rebuilt both fictional Death Stars with a continuous 2:1 PBR hull atlas, an integrated narrow equatorial trench, a recessed concave superlaser assembly, and a dense textured machinery interior for the unfinished station.
- Added browser captures at default, framed close, and extreme close zoom so distant framing can no longer conceal broken fictional-object geometry.

## [2.7.1] - 2026-08-08

### Changed in 2.7.1

- Replaced the runtime Roadster primitives with the detailed MIT-licensed SpaceDock Roadster and Starman mesh, checksummed and normalized to physical scale.
- Replaced the flat Death Star hull treatment with an original high-detail industrial texture and physically shaded station details.

## [2.7.0] - 2026-08-07

### Added in 2.7.0

- Added the Tesla Roadster and Starman from NASA/JPL Horizons solution 11 with 2018-2090 coverage, an original physical-scale reconstruction, searchable focus, selection statistics, and explicit payload-stack provenance.
- Added all six crewed Apollo lunar landing sites at LRO-derived Moon-fixed coordinates, selectable surface markers, full mission records, authoritative traverse and photograph links, and exact surface-observer viewpoints.
- Added REQ-178 through REQ-181 for the Roadster ephemeris, honest model provenance, Apollo surface registration, and landing-site interaction.

## [2.6.0] - 2026-08-07

### Added in 2.6.0

- Added one-second delayed identification of rendered Hipparcos stars with catalogue coordinates, magnitude, and colour-index metadata.
- Added an optional twelve-sign tropical zodiac reference on the J2000 ecliptic with explicit distinction from IAU constellation boundaries.
- Added REQ-176 and REQ-177 for delayed star identification and scientifically bounded zodiac presentation.

### Fixed in 2.6.0

- Replaced the seam-prone split ring compositor with one continuous physical sheet tested against the opaque globe depth buffer, so the far side is hidden by the planet and the near side correctly remains in front.
- Softened the approximate Saturn ring shadow so it no longer reads as an artificial black cut through the globe.

## [2.5.1] - 2026-08-07

### Changed in 2.5.1

- Made ordinary body focus and Re-centre use a continuously tracked Sun-facing view while retaining Parent-facing as an explicit orientation.
- Replaced five black-backed Voyager moon mosaics with the higher-resolution reconstructed global textures embedded in NASA VTAD's official Ariel, Miranda, Titania, Umbriel, and Triton models.
- Expanded the persistent browser capture audit to every installed planet, moon, observation-constrained material, and spacecraft presentation.

### Fixed in 2.5.1

- Replaced Saturn's opaque brown ring treatment with the Cassini radial colour and optical-density profile, sparse-division transmission, inverse-square illumination, adaptive exposure, body-aligned depth occlusion, and mutual planet-ring shadowing.
- Replaced Uranus's invented continuous procedural annulus with all 13 PDS rings at their sourced radii, widths, optical depths, and inner-grey, Nu-red, and Mu-blue colours without widening sub-pixel rings.
- Preserved Uranus's measured oblateness and made default focus frame the resolvable Epsilon ring while leaving the very diffuse Nu and Mu rings available by zooming out.
- Derived the focused camera near plane from body fit distance so Phobos-scale close views no longer fall behind the clip plane.

## [2.5.0] - 2026-08-06

### Added in 2.5.0

- Added anchored Surface Observer free-look with a centre-target action.
- Added ray-picked hover identification for rendered bodies and spacecraft whose persistent labels are hidden.
- Added a compact Reality navigation map with live planet positions, observer location, view direction, and scale.
- Added native three-dimensional heliosphere, illustrative Oort Cloud, and Hipparcos Alpha Centauri scale layers.
- Added REQ-171 through REQ-175 for free-look, hover identification, zoom reporting, continuous deep-space rendering, and navigation context.

### Changed in 2.5.0

- Kept the final three tour scenes in the primary renderer instead of replacing it with diagram overlays.
- Made wheel and trackpad dolly update the camera zoom control's displayed magnification.
- Rewrote the most software-focused tour cards and narration as direct astronomy explanations.
- Regenerated all context-affected British-voice narration files and their provenance hashes.
- Replaced hidden two-stage label orientation with conventional single-click selection, explicit Focus, double-click focus, and persistent Re-centre navigation.
- Made Parent and Next object browse the selected object without unexpectedly moving the camera.

### Fixed in 2.5.0

- Prevented Surface Observer tracking from overwriting user free-look every animation frame.
- Preserved the observer's physical position while the local view direction changes.
- Restored visible Saturn rings at low solar elevation with a declared unresolved-particle scattering approximation and pole-aware Sun-facing framing.

## [2.4.0] - 2026-08-06

### Added in 2.4.0

- Added REQ-169 for named rendering-quality profiles, inverse-square solar illumination, smooth focus-distance exposure adaptation, Sun-dependent atmospheric phase functions, and live frame diagnostics.
- Added live solar-incidence lighting and planet shadowing to Saturn's observed Cassini ring profile.
- Added installed-Chrome photographic reference captures for Earth, Saturn, and the authored close-Sun scene.
- Added a native immersive fullscreen mode that hides application chrome and interactive labels while retaining a restrained exit action.
- Restored all controls and focus when fullscreen exits through either the application action or the browser Escape mechanism.

## [2.3.0] - 2026-08-06

### Added in 2.3.0

- Added REQ-168 for physical surface observation from user-selected planetographic coordinates.
- Added a two-metre physical eye point, live NAIF surface orientation, geometric horizon, local compass, local solar time, and geometric sunrise and sunset regimes.
- Added live target altitude, azimuth, angular diameter, illuminated fraction, north-pole position angle, and bright-limb position angle.
- Limited supported observers to installed solid surfaces and explicitly excluded invented terrain, atmosphere, and refraction.

## [2.2.0] - 2026-08-05

### Added in 2.2.0

- Added Voyager 1 and Voyager 2 from NASA/JPL Horizons barycentric ICRF states as massless REBOUND test particles.
- Added physical-scale NASA-dimensioned Voyager models, searchable focus, Sun-relative statistics, labels, visibility control, and two guided-tour scenes.
- Added Hubble and JWST from NASA/JPL Horizons vector snapshots with coverage-bounded cubic Hermite interpolation.
- Added checksummed official NASA 3D models for the ISS, Voyager probes, Hubble, and JWST, normalized to sourced physical dimensions.
- Added grouped keyboard-operable focus search, logarithmic 1/64x to 128x zoom, and object-size-derived spacecraft framing.
- Added local-detail and Sun-referenced absolute-comparison Newtonian gravity-well scales.
- Added configurable Sun and nearest-planet wayfinders with live distances and clickable viewport-pinned endpoints.
- Added REQ-147 through REQ-158 for camera transitions, spacecraft physics and presentation, focus search, zoom, gravity scales, Sun-aware atmosphere scattering, wayfinders, and robust known-moon propagation.
- Added original educational narration for every guided-tour scene, generated as static ElevenLabs audio with reproducible provenance metadata and independent accessible controls.
- Added a final Alpha Centauri linear-scale scene showing that the preceding 220 AU view is about 0.08 percent of the roughly 272,000 AU distance.
- Added REQ-159 through REQ-164 for tour narration, static audio provenance, narration timing, the sourced interstellar comparison, and scene-relevant labels.
- Added a measured Voyager-scale heliosphere diagram explaining the solar wind, termination shock, heliopause, and the boundary model's limitations.
- Added a separate Oort Cloud scene with NASA's estimated inner and outer ranges, a physical-proportion shell, an Alpha Centauri comparison, and explicit illustrative-object disclosure.
- Added REQ-165 through REQ-167 for outer-region education and borderless selected-label hierarchy.

### Changed in 2.2.0

- Replaced simultaneous target translation, rotation, and dolly motion with separate depart, coast, and arrive camera phases.
- Routed observer-scene journeys around the physical observer origin independently of the remote look-at target, removing target dives and endpoint snaps.
- Extended guided transitions to 12 seconds and tour scenes to 28 seconds, with continuous destination tracking during accelerated simulation time.
- Separated automatic manual-navigation framing from authored tour framing so local journeys stay local and interplanetary journeys reveal their real separation.
- Replaced procedural spacecraft geometry with official NASA assets and a visible load-error state.
- Increased shared major-body sphere geometry to 256 by 192 segments and made atmosphere scattering respond to the live Sun direction.
- Replaced unconstrained known-moon Newton iteration with a complete-revolution reduction and bracketed Newton-bisection solve after reproducing the S2023_S38 failure at TDB -1723 days.
- Moved generated moon-state attachment out of the REBOUND worker and added an in-app simulation restart action for unexpected failures.
- Rewrote all fourteen tour cards and narration scripts to explain scale, physical models, display transformations, and scientific limits more clearly.
- Rewrote both Voyager scenes around heliopause distance, radio delay, physical spacecraft size, and continued Earth communication rather than renderer implementation details.
- Aligned each Voyager model's high-gain antenna boresight continuously to the live Earth position.
- Changed body and wayfinder labels to rotate the camera toward their target on the first click and focus with fitted zoom on the second click.
- Changed body and wayfinder labels to transparent borderless text, using colour and font weight to distinguish the selected target.
- Expanded the guided tour from fourteen to fifteen narrated scenes and regenerated every context-affected British-voice audio artifact with updated hashes.
- Changed the Neptune tour shot to a Sun-facing physical close-up with the live 30 AU Sun wayfinder instead of leaving Neptune hidden at the edge of a system overview.
- Suppressed unrelated spacecraft labels during authored tour scenes and prevented live-scene wayfinders from leaking through the Alpha Centauri diagram.

### Fixed in 2.2.0

- Reset the Focus picker to the complete grouped catalogue whenever it opens instead of retaining the current selection as a one-item search filter.

## [2.1.0] - 2026-08-04

### Added in 2.1.0

- Added REQ-146 for a persistent Sun bearing and live focus-to-Sun distance.
- Added a clickable Sun label that remains visible when ordinary body labels are disabled or the Sun is outside the camera view.
- Added explicit behind-camera wording and a safe-viewport bearing line so the guide does not overlap the primary camera and timeline controls.

### Fixed in 2.1.0

- Corrected every observer tour scene so the observer remains the selected origin for breadcrumbs, statistics, transitions, and Sun distance while the separately labelled look-at target stays centred.
- Replaced rushed 3.2-second linear camera moves with 7.5-second eased logarithmic-distance journeys and extended each automatic tour stop to 16 seconds so the overview and destination remain understandable.

## [2.0.1] - 2026-08-04

### Fixed in 2.0.1

- Made observer and target changes atomic so a new observer cannot be paired transiently with the previous scene's target.
- Moved observer cameras from singular body-centre coordinates to deterministic near-side positions above each body's physical reference radius.
- Added live-motion browser coverage proving that all four observer targets remain centred without uncaught rendering errors.

## [2.0.0] - 2026-08-03

### Changed in 2.0.0

- Replaced REQ-137's mandatory 90 AU transition with a hierarchical authored overview so local moves remain within their planetary system.
- Replaced REQ-139's invented prominence structures with an explicit prohibition on time-specific flare geometry without observational data.
- Strengthened REQ-140 so ordinary close planetary shots face the illuminated hemisphere.
- Removed Orrery enlargement from every guided scene and retained physical body radii throughout the tour.
- Changed Earth from Jupiter to identify Earth's physical sub-pixel position instead of drawing an enlarged globe.
- Replaced the Sun's hard transparent shell, radial rays, and perfect magnetic hoops with a subtle limb shader and smooth diffuse glow.

## [1.6.0] - 2026-08-03

### Added in 1.6.0

- Added REQ-141 through REQ-145 for scene-authored motion rates, tour pause behavior, physics-anchored observer cameras, disclosed visibility transformations, and honest clear-space viewpoints.
- Gave every guided scene a forward simulation rate selected to reveal its characteristic rotation or orbital motion without using scripted animation.
- Added Sun from Mars, Jupiter from Io, Earth from Jupiter, and Saturn from Titan scenes.
- Made observer cameras continuously follow both live REBOUND-backed bodies as simulation time advances.
- Disclosed 8x optical zoom, Orrery enlargement, and the absence of a reconstructed surface atmosphere wherever those qualifications apply.

## [1.5.0] - 2026-08-03

### Added in 1.5.0

- Added REQ-137 through REQ-140 for cinematic tour transitions, reduced-motion behavior, explicit solar-atmosphere presentation, and varied three-dimensional compositions.
- Added a three-phase guided-camera journey that eases from the current shot to a 90 astronomical-unit Solar System overview, briefly holds the overview, and eases into the next authored shot.
- Replaced the Sun's flat colour sphere with a granular procedural photosphere, chromosphere rim, radial corona, and three magnetic-loop prominence structures.
- Added a close solar-atmosphere scene to the guided scale tour so the new layers are discoverable without manual camera work.
- Classified the solar atmosphere as a procedural non-observational presentation because it does not claim to reconstruct historical space weather.
- Re-authored flat overhead tour scenes as perspective and parent-facing compositions.

## [1.4.0] - 2026-08-03

### Added in 1.4.0

- Added REQ-132 through REQ-136 for object-level focus, authored tour shots, explained tour overlays, clean Reality defaults, and compact collision-aware labels.
- Separated ordinary Earth focus from the deliberately wider Earth-Moon tour frame.
- Gave every scale-tour step an explicit camera distance, orientation, view mode, body-size treatment, overlay preset, and visual key.
- Disabled trails, orbit guides, the tactical overlay, and the ecliptic grid on a fresh Reality scene.
- Corrected the body-label font declaration so the intended compact size is no longer overwritten by the inherited font shorthand.

## [1.3.0] - 2026-08-03

### Added in 1.3.0

- Added REQ-128 through REQ-131 for explicit authority asset provenance, complete non-stellar major-body representation, honest observation-constrained materials where global maps do not exist, and bounded gravity-well display depth.
- Replaced heuristic NASA-page image selection with explicit NASA, JPL, and USGS asset URLs and a fail-closed Sharp conversion pipeline.
- Added high-resolution MESSENGER Mercury, Cassini Jupiter and Enceladus, Galileo and Voyager Ganymede, LROC and LOLA Moon, New Horizons Charon, and Voyager Oberon products.
- Added coverage and limitation metadata that distinguishes global composites, polar fill, reconstructed coverage, unobserved regions, enhanced colour, and visualization artwork.
- Added complete executable checks for every non-stellar major-body presentation and reduced the gravity landscape depth from 8 percent to 3.2 percent of its field extent.

## [1.2.0] - 2026-08-03

### Added in 1.2.0

- Added REQ-120 through REQ-127 for live positive-GM Newtonian potential superposition, explicit massless-body exclusion, sourced-radius surface capping, simulation-time synchronization, accessible contour and surface modes, physical joules-per-kilogram diagnostics, and display-only displacement.
- Added GPU-evaluated J2000 ecliptic-parallel potential contours and a perspective energy-landscape surface using the current 31-body massive state.
- Added unit coverage for the potential equation, superposition, surface capping, display range, and invalid sources.
- Added an installed-Chrome journey that proves both rendering modes change the real canvas and remain synchronized with body focus and simulation time.

## [1.1.0] - 2026-08-03

### Added in 1.1.0

- Added REQ-110 through REQ-119 for a validated CelesTrak OMM snapshot, UTC-aligned SGP4 propagation, TEME-to-J2000 frame conversion, massless coupling to the live Earth state, bounded validity, physical NASA dimensions, subpixel suppression, a Spacecraft control, and textual provenance.
- Added a NASA-dimensioned procedural ISS model that uses one physical scale for its 109 by 73 metre footprint and its orbital separation from Earth.
- Added a searchable ISS focus that seeks from the Solar System epoch to the installed orbital-element epoch before displaying the station.
- Added an installed-Chrome journey that proves the ISS is resolvable from 500 metres and disappears below one pixel from the Earth-system view.

## [1.0.0] - 2026-08-03

### Implemented

- Changed REQ-042 so unresolved point and density representations are confined to declared nonphysical locator views.
- Added REQ-106 through REQ-109 to make Reality a strict physical-scale view, suppress subpixel geometry, hide unknown-radius catalogue objects, and retain continuous scaling only in Orrery.
- Moved the body-size boost into Orrery and disabled asteroid and comet locators in Reality.
- Added REQ-100 through REQ-105 for browser-authorised ambient music, control feedback, independent accessible audio controls, persisted preferences, and hidden-document suspension.
- Added an original deterministic Web Audio soundscape with slowly changing pad harmony, filtered texture, delay, and sparse chimes without third-party audio assets.
- Added distinct short feedback tones for buttons, disclosures, selection controls, and range controls.
- Added a searchable focus control for all installed available moons without constructing a hundreds-entry native select.
- Made all 437 available additional moons visible under the Moons layer instead of limiting the layer to the selected parent system.
- Added continuously tracked parent-facing, velocity, and orbital-plane camera presets, semantic label density, scale-aware distance units, and exact unresolved-body Orrery markers.
- Added an explicit present-day ephemeris validation boundary in the timeline and a compact scientific-model disclosure in the Display panel.
- Corrected giant-planet radius capping so no display transformation can shrink a body below its physical radius.
- Corrected negative-semi-major-axis hyperbolic propagation, added stable near-parabolic and high-eccentricity Kepler starters, and validated GPU elliptic and hyperbolic positions against an independent CPU model.
- Replaced recurring WebGPU texture readback and CPU scans with direct GPU canvas presentation while retaining startup authority, finite-position, and rendered-frame validation.
- Added WebGPU device-loss diagnostics and configured browser verification to use installed Chrome and the laptop's real WebGPU backend.
- Synchronized the interface clock, selected-body facts, map, and three-dimensional scene to interpolated presentation time without rerendering the React interface every animation frame.
- Added drawer focus management, Escape close behavior, restored trigger focus, valid document metadata, an embedded favicon, and exact GPU error announcements.
- Added ESA Hipparcos licence, credit, and CDS VizieR acknowledgement terms to the third-party notices.

- Corrected star point sizing for high-density displays and increased magnitude-derived minimum exposure so the Hipparcos layer remains perceptible without changing catalogue positions.
- Added category-aware small-body sampling with a 1,024-record pre-frustum floor per enabled category so the 4,069 comets no longer disappear under the 1,554,071-asteroid density rate.
- Added double-buffered exact-state playback, render-adaptive endpoint display, and separate requested-versus-measured achieved-rate status without increasing the one-day maximum solver interval.
- Added Back, Home, Parent, and Next object navigation plus double-click focus for rendered major bodies.
- Added trail-duration, fade, and clear controls for exact Moon and planet trails, plus screen-space fading history of GPU-propagated minor-body positions.
- Replaced the synthetic star field with a validated local snapshot of 8,789 ESA Hipparcos stars brighter than Johnson V 6.5, using ICRS positions, published proper motions, V-magnitude prominence, B-V display colour, and an independent Stars toggle.
- Added Fresnel atmosphere rims, a restrained solar corona, and procedural ring banding while retaining local checksummed NASA surface maps.
- Moved massless known-moon expansion out of batched Worker transfers and presents every available installed moon from the same reversible two-body propagator around its exact parent endpoint.
- Added independently switchable planet trails sampled only from exact physics endpoints, with Sun-relative and Earth-relative frames shared with the Moon trail.
- Changed focused planets to an illuminated 2x Sun-facing view and the initial playback rate to one simulated hour per real second so authoritative surface rotation is visually legible.
- Added a browser regression that advances Earth by three exact one-hour physics steps and verifies both the NAIF prime-meridian change and a change in the captured rendered surface.
- Corrected the ICRF-to-y-up transform to preserve right-handed coordinates in the major-body and WebGPU renderers; the previous reflected basis collapsed a 45-degree Earth orientation change to about 0.11 degrees in the mesh quaternion.
- Replaced the explanatory dashboard copy with a compact operational toolbar and kept scientific/model detail in the README.
- Changed the simulation clock to adaptive seconds, minutes, hours, or days with at most two decimal places for day values.
- Reduced header, control, and button spacing so the simulated scene receives substantially more of the viewport.
- Kept the full 90 AU system framing when focusing the Sun, so Sun-centred tracking does not crop away Earth or the outer planets.
- Corrected the initial camera so the declared Perspective preset matches its actual J2000 ecliptic-relative direction and frames the outer planets.
- Kept the initial Reality overview at physical scale with asteroid and comet locators unavailable until Orrery is selected.
- Kept in-frustum planet labels visible in the full-system overview, reduced the label threshold for other enhanced major bodies, and added an end-to-end contract that Mercury through Neptune are all visible on first load.
- Corrected overview size capping so hidden moons do not shrink their parent planets, and verified every planet has at least a one-pixel rendered diameter without allowing enhanced neighbours to overlap.
- Added continuous 0.5x to 8x camera zoom with wide, normal, close, and detail presets.
- Added perspective, J2000 ecliptic overhead, ecliptic edge-on, Sun-facing, custom, and reset-view camera states.
- Added all 459 entries from the current JPL Horizons planetary-satellite index, including provisional moons.
- Added common-epoch vectors for 458 indexed satellites and retained Daphnis as explicitly unavailable because its JPL trajectory stops in 2018.
- Kept 21 major moons in the perturbing REBOUND model and added 437 smaller moons through reversible parent-centred two-body propagation around live REBOUND parent states.
- Added focus selection, local-system point rendering, and textual physics classification for the additional moons without rendering them as false full-system one-pixel blobs.
- Added a live selected-body rotation angle and browser evidence that Earth rotation changes with simulation time while remaining frozen when time is paused.
- Replaced approximate `G * mass` inputs with authority-published DE440 gravitational parameters and configured REBOUND IAS15 directly in SI-derived `GM` units.
- Added full NAIF PCK pole, nutation, and prime-meridian models for accurate major-body orientation and rotation.
- Added permanent seven-epoch NASA/JPL Horizons regressions for Earth-Sun and Moon-Earth separation from -365 through +365 days.
- Corrected minor-body coordinates from J2000 ecliptic into the ICRF-aligned render frame.
- Separated playback rate from integration keyframe size, limited continuous keyframes to one simulated day, and added velocity-constrained Hermite interpolation between exact completed solver states.
- Added Sun-relative and Earth-relative Moon trails composed only of exact solver endpoint samples.
- Added body focus, tracking, labels, selected-body facts, ecliptic plane display, and reset-orientation controls.
- Added independent planet, moon, asteroid, and comet visibility controls.
- Added a continuous true-to-visible body radius scale with nearest-neighbor overlap protection.
- Added local, checksummed NASA textures, Earth clouds, Moon topography, rings, atmosphere shells, and neutral materials where an authoritative surface asset is unavailable.
- Added focus-region and zoom-dependent GPU level of detail so subpixel minor bodies remain catalogue-derived without becoming a false one-pixel fog.
- Added browser assertions for GPU output, visibility filters, camera movement, level of detail, continuous scale, signed time, focus framing, trail frames, reset orientation, and high-rate interpolation.

### Current scientific boundary

- The executable present-day scenario contains 31 active massive bodies, including eight planets, Pluto, and 21 major moons, plus 437 small-moon two-body states.
- The JPL planetary-satellite snapshot retains 459 indexed moons; 458 are available at the common epoch and Daphnis is explicitly unavailable.
- The NASA/JPL SBDB snapshot contains 1,558,140 asteroid and comet records, of which 1,556,349 have complete elements for GPU two-body propagation and 1,791 are retained as explicitly unavailable.
- The present scenario does not claim the more than 470 additional confirmed companions of asteroids, trans-Neptunian objects, and other dwarf planets outside the JPL planetary-satellite index, or every authority-recognized dwarf planet as an active massive body.
- Formation and solar-evolution views remain unavailable until cited scenario models with uncertainty contracts are installed.

## [0.1.0] - 2026-08-02

Initial target requirements draft for implementation.

### Added

- Added Jupiter's five PDS dust-ring components and Neptune's five named ring structures with measured radii, widths and optical depths, plus an Orrery-only visibility gain for the exceptionally faint dust.
- Added original physical-scale Death Star I and incomplete Death Star II models on disclosed hypothetical massless circular paths around Callisto and Ganymede.
- Added physical-scale Apollo descent stages, flags, ALSEP equipment, retroreflectors and applicable lunar rovers at all six landing sites.
- Added a reproducible NASA LROC PDS traverse snapshot for every available Apollo 11, 12 and 14 CDR/LMP path segment, projected into local metre offsets without invented route geometry.

- Physics-derived motion with no scripted trajectory substitution.
- Authoritative catalogue, ephemeris, provenance, and uncertainty boundaries.
- True-scale and disclosed visible-scale rendering requirements.
- Free camera, observer, object-following, and coordinate-frame requirements.
- Forward, backward, micro-time, macro-time, and deep-time regimes.
- Formation, solar evolution, event, mission, gravity, light-time, discovery, comparison, sonification, and hypothetical-impact modes.
- Error handling, security, performance, accessibility, and verification requirements.
