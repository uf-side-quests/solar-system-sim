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

The camera uses standard orbit controls: left drag orbits, right drag pans, and wheel or pinch dollies toward or away from the current target.
Flight mode provides low, equatorial, polar, synchronous, high-observation, powered-hover, and custom orbit presets around bodies with sourced radius and gravity data.
Circular speed and period are derived from the live gravitational parameter, while powered hover reports the continuous station-keeping acceleration it requires.
The cool-shot presets apply a coherent focus, viewpoint, scale, orientation, overlay set, and simulation rate for Earth and Moon, Saturn, Jupiter from Io, Discovery One, Voyager, and the planetary system.
The camera also supports logarithmic 1/64x to 128x optical zoom, grouped searchable named-body focus, continuous tracking, and one-action view reset.
An always-visible camera dock provides Back, Zoom out, Zoom in, Re-centre, Home, and a guided scale tour.
The compact Reality navigation plot uses live simulation positions in a Sun-centred J2000 ecliptic projection, with selectable 2 to 300,000 AU radii plus an automatic range.
Its destination list covers the Sun, planets, major moons, installed spacecraft, and clearly labelled fictional references; selecting an entry identifies it without moving, while Travel or a map double-click uses the same orient, coast, and decelerate camera journey as every other focus change.
Each tour change uses a slow logarithmic-distance journey through the smallest useful context view, holds that overview long enough to establish location, and then settles into the next composition.
Earth-to-Moon and planet-to-moon moves remain inside their local system, while interplanetary moves reveal only the wider scale they need.
Every guided scene remains on screen for twenty-eight seconds, including a twelve-second depart-coast-arrive camera journey, and selects a forward simulation rate that makes the relevant rotation or orbital motion visible.
Pausing the tour pauses the physics clock.
All twenty-two scale-tour and eclipse-story scenes have original educational scripts and matching static ElevenLabs narration tracks.
Narration pauses and resumes with the tour, has independent enable and volume controls, and temporarily lowers the ambient music so the explanation remains intelligible.
Physics-anchored observer scenes select Mars, Io, Jupiter, or Titan as the view origin, place the camera above that body's physical radius, and continuously point it toward the live target body.
Breadcrumbs, selected-body data, transition framing, and Sun distance remain anchored to the observer rather than switching to the look-at target.
These are clear-space orbital viewpoints rather than invented terrain or atmospheric panoramas, and any optical zoom or physical sub-pixel limit is disclosed in the tour card.
The separate Surface observer mode accepts planetographic latitude and positive-east longitude on any installed solid major body, excluding the four giant planets.
It places a two-metre eye point above the body's sourced mean-radius reference sphere using the live NAIF pole and prime-meridian orientation, then tracks a selected live major body from that fixed location.
The local display reports altitude, azimuth, true angular diameter, illuminated fraction, target north-pole and bright-limb position angles, local solar time, and geometric sunrise or sunset conditions.
Its calculated horizon and compass use the same oriented reference sphere as the camera, while the interface explicitly discloses that terrain, atmosphere, and refraction are not modelled.
Every guided scene keeps body radii physical; the tour never inflates moons or planets with Orrery sizing.
Focusing an object now uses a true 1× fit instead of silently applying additional optical magnification.
The View angle panel provides seven direct buttons for 3D, above, side, sunlit, parent, path, and orbital-plane views.
Each button explains the resulting camera position, while free drag changes the current view to Custom.
Reality view uses sourced physical radii on the same scale as body separation and draws no geometry below one CSS pixel in diameter.
Objects without installed radii, including catalogue-only moons and the asteroid and comet snapshot, do not receive false one-pixel markers in Reality.
Orrery view provides the continuous body-size boost, readable markers, and instantaneous osculating orbit guides derived from the current solver position and velocity, while Map view uses logarithmic spacing and retains each body's live orbital phase.
The tactical overlay derives adaptive distance rings, parent direction, velocity direction, and ecliptic-plane offset from the current physical state.
Semantic zoom changes label density and unit precision as the camera moves from the complete Solar System into a planetary, moon, or surface-scale view.
Collision-aware labels retain all overview planets and move overlapping labels onto nearby leader lines rather than hiding the body or inflating it into a false large sphere.
Body and wayfinder labels are borderless transparent annotations; colour and font weight distinguish the selected target without adding opaque boxes over the scene.
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
Its official NASA 3D model is normalized to NASA's 109 metre maximum end-to-end dimension on the same physical scale as its orbit, so it disappears below one pixel from an Earth-system view and becomes visible only from a close spacecraft focus.

Voyager 1 and Voyager 2 use NASA/JPL Horizons barycentric ICRF states at the common 2026 epoch and then run inside REBOUND as massless test particles.
Their official NASA model attitude continuously points the high-gain antenna's local boresight toward the live Earth position.
Hubble and JWST use published NASA/JPL Horizons position and velocity samples with cubic Hermite interpolation only inside their installed 2026 coverage windows.
Hubble and JWST are not passed through the N-body solver because their real operational trajectories include drag, stationkeeping, and manoeuvres that an uncommanded gravity-only model cannot reproduce.
The Tesla Roadster and Starman use NASA/JPL Horizons solution 11 across its published 2018-2090 interval, including the fitted radial solar-radiation-pressure acceleration, and disappear rather than extrapolate outside that coverage.
The Roadster visual uses the detailed MIT-licensed SpaceDock model by TheBigElon, with the Starman mesh credited to Oranhunter, normalized to the Roadster's 3.946 metre maximum dimension.
Horizons tracks the car, payload fitting, and attached Falcon Heavy upper-stage stack rather than the car alone.
ISS, both Voyagers, Hubble, and JWST use checksummed official NASA 3D models at sourced physical dimensions.
The model loader fails visibly instead of replacing a missing authority asset with procedural geometry.

The Moon carries selectable markers for Apollo 11, 12, 14, 15, 16, and 17 at LRO-derived planetocentric landing coordinates.
Each site includes physical-scale Lunar Module descent-stage, flag, deployed experiment and retroreflector geometry; Apollo 15, 16 and 17 also include a physical-scale Lunar Roving Vehicle.
Apollo 11, 12 and 14 additionally render every available CDR and LMP line segment from the current LROC spatio-temporal PDS traverse mapping, converted from each mission's published lunar equirectangular projection into local metre offsets.
Each marker rotates with the NAIF Moon orientation, hides behind the lunar globe, opens crew, Lunar Module, duration, EVA, traverse, experiment, mapping, and photograph records, and can place the Surface Observer at the installed landing coordinates.

Major-body rotation uses the complete NAIF PCK pole, nutation, and prime-meridian model for each installed body.
ICRF positions and body axes are transformed into the Three.js y-up scene with a right-handed basis, and the WebGPU small-body path uses the same transform.
Surface presentation uses 32 locally snapshotted NASA, JPL, and USGS texture products with explicit source URLs, source and output dimensions, coverage, projection, limitations, byte lengths, and SHA-256 hashes.
Twenty-nine colour maps cover every non-stellar major body except Uranus, while separate Earth-cloud and Moon-topography products provide auxiliary detail.
Mercury uses the USGS 23,040 by 11,520 pixel MESSENGER end-of-mission global colour mosaic, while Pluto uses the 24,888 by 12,444 pixel USGS/New Horizons observational mosaic; both are reduced to 4,096 pixels for a bounded browser GPU footprint.
The Moon, Ganymede, Enceladus, and Charon also use authority masters reduced to the same browser limit.
Ariel, Miranda, Titania, Umbriel, and Triton use the higher-resolution global textures embedded in NASA VTAD's official glTF models; their Voyager-observed terrain and authority-reconstructed coverage are distinguished in the manifest.
Saturn uses the 3,601 by 1,801 pixel Cassini ISS global RGB atmosphere map from NASA's Planetary Data System, with unobserved regions feather-filled from the separately declared NASA visualization rather than left black.
Its globe preserves the measured equatorial and polar radii, while its main rings use a natural-colour Cassini radial mosaic covering 74,565 to 136,780 kilometres from Saturn's centre instead of generated sine-wave bands.
The ring plane uses globe depth occlusion and calculates both the planet's shadow on the rings and the rings' shadow on the planet from the live Sun direction.
Uranus has no solid visible surface and no complete contemporaneous global cloud map, so it uses a Voyager-constrained atmosphere colour instead of fictional terrain.
Its oblate globe is surrounded by the 13 individually modelled PDS rings at their published radii, widths, and optical depths; the narrow dark main rings retain sub-pixel coverage instead of being widened, while the diffuse Nu and Mu rings retain their published red and blue presentation.
Jupiter's halo, main ring, two gossamer rings and Thebe extension, plus Neptune's five named main-ring structures, use NASA PDS radii, widths and optical depths.
Reality mode preserves those very low optical depths; Orrery mode applies a declared bounded visibility gain so the dusty systems can be inspected without widening their measured radial structure.
These dusty systems remain appropriately faint in Reality; Orrery applies a disclosed visibility gain so their measured locations can be studied without widening them.

Two high-detail Death Star references orbit Callisto and Ganymede at physical scale.
Death Star I uses the original integrated model.
Death Star II uses an optimised CC BY model with complete colour, normal, occlusion, metallic, roughness, and emissive maps.

An optimised CC BY physical-scale Discovery One model orbits Io, where 2010 places the ship.
Its command sphere, pod bays, truss spine, external tanks, high-gain antenna, and propulsion module are lit by the same inverse-square Sun source as the real objects.
Because no precise trajectory is published, its displayed 400 kilometre circular orbit is clearly identified as an authored massless two-body reference rather than historical ephemeris.
They are explicitly fictional massless visualizations on hypothetical circular two-body paths derived from each moon's live gravity and state, and they never enter or perturb the REBOUND integration.

Deep Space Nine uses a high-detail CC BY model at its 1.45 kilometre reference diameter.
The application places it in a clearly labelled hypothetical circular exhibit orbit around Callisto because its fictional Bajoran system is outside this Solar System model.
The USS Defiant uses a textured high-detail free model at its 170.68 metre production reference length.
It follows an explicit 30 minute defensive patrol around the station.
The station mass is not published, so the patrol uses no invented gravitational parameter and never enters the REBOUND integration.
Coverage-filled, reconstructed, unobserved, enhanced-colour, and visualization regions remain explicit in the manifest rather than being presented as uniformly measured imagery.
Planet surfaces use inverse-square Sun-position point lighting with smooth focus-distance exposure adaptation, so outer planets receive the correct weaker incident flux without becoming unreadable.
Atmosphere shells use body-specific Rayleigh and Mie phase approximations driven by the live Sun direction, so the dark hemisphere does not receive a false bright rim.
Saturn's observed Cassini ring profile is lit from the live solar incidence angle, includes mutual planet-ring shadowing, and uses a bounded unresolved-particle scattering approximation so low-incidence rings do not become a false solid-black sheet.
The Display panel offers Battery, Balanced, and Photographic rendering profiles that explicitly trade pixel density, texture filtering, atmosphere sampling strength, and solar-corona density.
The command bar includes a native Full screen action that expands the simulation to the display, hides application controls and interactive scene labels, and restores the complete interface when the user exits with the corner action or browser Escape key.
Major-body spheres use shared 256 by 192 segment geometry so close orbital views do not expose coarse planetary facets, while retaining the checksummed authority textures and bounded browser texture resolution.
The Sun combines a granular procedural photosphere, subtle chromosphere rim, and restrained diffuse corona.
The renderer does not invent prominence or flare geometry because no generic animation can truthfully claim the Sun's actual activity at arbitrary simulation times.
The background contains 8,789 stars from the ESA Hipparcos catalogue with Johnson V magnitude below 6.5.
Catalogue ICRS positions are propagated from J1991.25 to the simulation date using the published proper-motion components where both are available, while missing motion remains explicitly unknown and fixed at the catalogue epoch.
Point prominence is derived from Johnson V magnitude in CSS pixels so high-density displays do not reduce stars to invisible subpixels, display colour is approximated from the measured B-V index, and the complete star layer can be switched off independently.
Holding the pointer over a rendered star for one second identifies its Hipparcos number, Johnson V magnitude, right ascension, declination, and B-V colour index where available.
The optional Zodiac sky overlay draws the familiar twelve equal tropical signs along the J2000 ecliptic as a coordinate reference; it does not claim the labels are IAU constellation boundaries or images of constellation figures.
The stellar directions are effectively the same from every planet at this display scale because the Solar System baseline is tiny compared with stellar distances, although nearby stars do have real but very small parallax.

The application generates an original ethereal ambient composition locally with the Web Audio API, using slowly changing harmony, filtered pad voices, delay, and sparse chimes rather than a licensed loop.
Browser autoplay rules keep the application silent until the first interaction.
Ambient music, interface feedback, and tour narration have independent enable and volume controls, persist within local browser storage, and suspend while the page is hidden.
The committed narration is AI-generated speech from original educational scripts using ElevenLabs, and its manifest records the voice, model, settings, text hashes, and audio hashes.
The ElevenLabs credential is used only by the explicit generation command and is not shipped to the browser.

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
pnpm data:horizons-voyagers
pnpm data:horizons-spacecraft
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

`pnpm complete` checks formatting, lint, documentation, strict types, the complete unit suite, the production build, a numerical WebAssembly invariant test, a permanent NASA/JPL Horizons regression, and every installed-Chrome interaction journey.
The smoke test integrates a Sun-Earth system through one calculated orbital period and checks the final separation and energy error.
The Horizons regression compares integrated Earth-Sun and Moon-Earth separation against seven fixed authority reference states from -365 through +365 days.
The current maximum errors are 60,961.474 m for Earth-Sun and 13,743.411 m for Moon-Earth after one year, within the checked 100 km and 20 km bounds.
The browser test verifies that the rendered solver state loads and that the REBOUND worker advances simulated time through the user control.
It validates representative elliptic and hyperbolic GPU positions against an independent CPU authority model, samples finite positions, and checks an offscreen render before the layer becomes ready.
It then captures the directly presented Orrery small-body canvas through the browser compositor, failing unless catalogue-coloured pixels are actually visible, and verifies the independent planet, moon, asteroid, and comet filters, camera rotation, zoom-dependent level of detail, micro-to-macro time-step selection, forward and backward integration, and both endpoints of the continuous Orrery body-size boost.
The audio journeys exercise the native browser audio context, verify feedback oscillator creation for mouse and keyboard controls, check audio preference restoration after reload, and prove that tour narration plays, pauses, resumes, and changes track with the scene.
The tour-review journey renders and captures all fifteen scenes, checks their authored titles and sequence, and fails on browser, page, or simulation errors.
The eclipse-story journey checks all seven 12 August 2026 scenes at their exact model times and captures each rendered view.
It verifies London contact geometry, apparent solar and lunar diameters, live disc overlap, and a physical centre-line comparison in northern Spain.
The gravity-field journey verifies positive-GM superposition, sourced-radius surface capping, physical joules-per-kilogram diagnostics, contour and surface rendering, local-detail and absolute-comparison scaling, and synchronization with simulation time.
The photographic-rendering journey verifies the three rendering profiles, bounded device-pixel ratios, inverse-square illumination metadata, smooth auto-exposure, Sun-facing close-view framing, live atmosphere and Saturn-ring lighting models, and measured browser frame diagnostics before capturing Earth, Saturn, and the close Sun.
The immersive-mode journey enters the browser's native fullscreen presentation from a live surface observer, proves the command bar, camera controls, observer panel, timeline, and interactive labels are hidden, then exits and verifies the complete interface and keyboard focus are restored.

The Display panel independently filters planets and dwarf planets, moons, spacecraft, asteroids, comets, and catalogue stars.
The same panel independently controls ambient music, interface feedback, tour narration, and their volume levels.
The initial Reality overview uses physical scale, so labels identify bodies whose geometry is too small to resolve without turning them into false visible pixels.
Asteroid and comet locator layers are available only in Orrery.
The Sun remains visible as the reference origin even when every category is hidden.
Every focused view can show physics-derived wayfinders for the Sun and the nearest one or two planets; each endpoint reports live separation and pins to a safe viewport edge when off-screen or behind the camera.
Click any rendered body, body label, or wayfinder label once to select it and show its facts without moving the camera.
Use the explicit Focus action or double-click the rendered object or label to travel to it and fit its default view.
The Display panel switches wayfinders between Off, Sun, Sun plus nearest planet, and Sun plus two nearest planets.

The keyboard-operable Focus control opens with the complete grouped catalogue after every selection and searches overview, star, planet, moon, major-body, and spacecraft names and categories as the user types.
Back and Home move the camera through focus history, while Parent and Next object browse the current selection before the user chooses Focus.
Focusing the Sun preserves the full-system 90 AU framing while centring the heliocentric reference body.
Focusing Earth fits Earth itself; the separate Earth-Moon tour shot frames their real separation explicitly.
Reality starts with trails, orbit guides, the tactical overlay, the ecliptic grid, and gravity surfaces off so the physical scene is not obscured by unexplained lines.
The optional Moon and planet trails contain only exact physics endpoint samples.
Trails can be viewed in heliocentric, Solar System barycentric, or body-parent-relative frames, making inertial motion and local orbital motion directly comparable without decorative orbit curves.
Trail length and fading are adjustable, and Clear trails removes all accumulated history immediately.
The optional Orrery minor-body trail uses fading screen-space history of actual GPU-propagated catalogue positions, resets when the camera changes, and applies to whichever asteroid and comet categories are visible.
Selecting a body starts with a fitted 1x Sun-facing view so its illuminated hemisphere remains legible; the ordinary zoom and orientation controls remain available.
The selected-object card reports source-snapshot mass, sourced bulk composition, and names the parent used as the velocity reference, such as "Speed relative to Sun" for Earth and "Speed relative to Earth" for the Moon.
When the installed Horizons satellite catalogue does not provide mass or composition, the card says so explicitly rather than substituting an estimate.
Reset, Re-centre, or the `R` key restores a known Sun-facing body view when navigation becomes disorienting.
The camera dock remains visible at narrow widths, and Re-centre always restores the focused object's intended framing after orbit, pan, wheel, pinch, or optical zoom.
The fifteen-step Scale of the Solar System tour moves from a close Earth shot through the Earth-Moon gap, the Sun, observer viewpoints, the giant planets, Neptune, both Voyager probes, the heliosphere, the predicted Oort Cloud, and a final linear comparison to the Alpha Centauri system.
Each step owns its camera distance, orientation, view mode, body-size treatment, and overlay set; any orbital guide it enables is named in the tour card.
The tour can auto-advance, pause, resume after manual camera control, move step by step, or exit without changing the physics model.
The heliosphere diagram explains the solar wind, termination shock, heliopause, measured Voyager crossings, and the boundary's directional and time-varying nature.
The following Oort Cloud diagram uses NASA's estimated 2,000-5,000 AU inner edge and 10,000-100,000 AU outer range while identifying every displayed particle as illustrative rather than catalogued.
The Alpha Centauri scene is an explicitly labelled distance diagram rather than an extension of the live Solar System N-body calculation.
It shows that even the possible 100,000 AU outer Oort Cloud reaches only about 37 percent of the roughly 272,000 AU journey and magnifies the first 220 AU in a separate inset.

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
Their bound elliptic propagation removes complete orbital revolutions before solving a bracketed universal-variable equation, keeping accelerated forward and reverse playback numerically convergent.
Generated moon states are attached after the REBOUND result and cannot terminate the active N-body engine.

The ISS uses an authority snapshot rather than a live network request so every run is reproducible.
SGP4 includes the perturbation and drag terms encoded by the OMM, but the installed element solution is intentionally treated as unavailable more than seven days from its epoch.
The official NASA station model is dimensionally scaled and oriented to the instantaneous local orbital frame; its attitude is not a telemetry reconstruction.

Voyager 1 and Voyager 2 use NASA/JPL Horizons barycentric ICRF state vectors at the common 2026 epoch.
They run inside REBOUND as massless test particles, so every massive body deflects their paths while the probes do not perturb the planets.
Their shared official NASA 3D model uses the published maximum dimension at one physical scale; its attitude is illustrative rather than telemetry-derived.

Hubble and JWST use fixed NASA/JPL Horizons vector snapshots with cubic Hermite interpolation between published position and velocity samples.
Interpolation stops at the declared coverage boundaries instead of clamping or extrapolating an apparently plausible position.
The application currently installs six spacecraft and artificial payloads and does not claim to contain every active spacecraft or probe in the Solar System.

Small bodies currently use a declared Sun-centred two-body Kepler model on the GPU.
They do not yet receive planetary perturbations or perturb the massive REBOUND system.

The star layer is astrometric within the installed Hipparcos data and its linear proper-motion model, but point size, opacity, and B-V colour mapping are perceptual rendering treatments rather than calibrated photometry.
Atmosphere, corona, and ring-band shaders are disclosed rendering treatments rather than new measured surface data.
Inter-body eclipse shadows are not yet modelled; the current lighting accurately supplies Sun-facing illumination and day-night terminators but does not claim occultation shadows.
The gravity overlay is Newtonian potential on a two-dimensional J2000 ecliptic-parallel slice.
Local detail normalizes the selected field to expose nearby structure, while absolute comparison uses one fixed Sun-referenced logarithmic scale that correctly makes planetary wells appear much shallower.
Its logarithmic contours and rendered depth are perceptual mappings of calculated potential, not additional forces, physical deformation, or general-relativistic curvature.
Perspective depth is capped at 3.2 percent of the field extent so the visual well remains attached to the orbital slice instead of appearing detached from its source body.

## Licensing

This project and its REBOUND-linked WebAssembly distribution are licensed under GPL-3.0.
The pinned REBOUND source and its license are included under `vendor/rebound/`.
The MIT-licensed satellite.js and Astronomy Engine dependencies supply SGP4 and celestial-frame rotation respectively; their exact versions and integrity hashes are locked in `pnpm-lock.yaml`.
