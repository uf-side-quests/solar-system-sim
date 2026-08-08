# Third-Party Notices

## REBOUND

REBOUND 5.0.0 is distributed under the GNU General Public License version 3.

- Upstream: <https://github.com/hannorein/rebound>
- Pinned commit: `65685ac82644150f166d1c2979746fbdef7fe7b7`
- Included source: `vendor/rebound/`
- Included license: `vendor/rebound/LICENSE`

The local WebAssembly build disables REBOUND's browser event-loop yield inside synchronous integration because the solver runs in a dedicated Web Worker and the exported bridge is synchronous.
The patch is guarded by `REB_EMSCRIPTEN_NO_YIELD` and does not change the numerical integration algorithm.

## JavaScript dependencies

JavaScript dependency names, resolved versions, integrity hashes, and transitive dependencies are recorded in `pnpm-lock.yaml`.

### satellite.js

satellite.js 7.1.0 supplies OMM parsing and SGP4 propagation and is distributed under the MIT License.

- Upstream: <https://github.com/shashwatak/satellite-js>
- Package: <https://www.npmjs.com/package/satellite.js>

### Astronomy Engine

Astronomy Engine 2.1.19 supplies the equator-of-date to J2000 mean-equator rotation and is distributed under the MIT License.

- Upstream: <https://github.com/cosinekitty/astronomy>
- Package: <https://www.npmjs.com/package/astronomy-engine>

### sharp

sharp 0.35.3 converts authority TIFF and JPEG masters into bounded browser-ready WebP and PNG snapshots during explicit data refreshes and is distributed under the Apache License 2.0.

- Upstream: <https://github.com/lovell/sharp>
- Package: <https://www.npmjs.com/package/sharp>

### Downshift

Downshift 9.4.0 supplies the accessible searchable focus combobox and is distributed under the MIT License.

- Upstream: <https://github.com/downshift-js/downshift>
- Package: <https://www.npmjs.com/package/downshift>

### Three.js Draco decoder

The vendored Draco decoder artifacts under `public/draco/` are distributed with Three.js 0.185.1 under the MIT License.

- Upstream: <https://github.com/mrdoob/three.js/tree/r185/examples/jsm/libs/draco>

## ElevenLabs generated narration

The static MP3 files under `public/audio/tour/` are AI-generated speech from original educational scripts produced through the ElevenLabs text-to-speech API.
They use the British ElevenLabs voice `Alice - Clear, Engaging Educator`, voice identifier `Xb7hH8MSUJpSbSDYk0k2`, and model `eleven_multilingual_v2`.
The local manifest records generation settings and cryptographic hashes for the scripts and generated audio.
The ElevenLabs API key is not included in the application, generated files, or manifest.

- API documentation: <https://elevenlabs.io/docs/api-reference/text-to-speech/convert>

## Tesla Roadster and Starman 3D model

`public/models/community/roadster-starman.glb` is converted from Elon's Roadster & Starman 2.1.1, published on SpaceDock under the MIT License.
The source archive credits TheBigElon for the Roadster model, Oranhunter for the Starman model, and pr3sidentspence for the pre-2.0 original textures.

- Source: <https://spacedock.info/mod/1797/Elon%27s%20Roadster%20%26%20Starman>
- Creator profile: <https://spacedock.info/profile/TheBigElon>
- Installed SHA-256: `1f033cb4a8e47fa852494e37927cf3d8008b9fb18e26fdc586bfc5a631392184`

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## NASA and JPL data and imagery

Major-body initial states and the permanent regression reference states are NASA/JPL Horizons data.
Authority-published gravitational parameters and rotation models are taken from JPL NAIF generic kernels.

- Horizons: <https://ssd.jpl.nasa.gov/horizons/>
- JPL planetary-satellite ephemerides: <https://ssd.jpl.nasa.gov/sats/ephem/>
- NAIF DE440 gravitational parameters: <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de440.tpc>
- NAIF planetary constants: <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc>
- NASA 3D Resources: <https://science.nasa.gov/3d-resources/>
- NASA International Space Station 3D model: <https://science.nasa.gov/3d-resources/international-space-station-iss-d-igoal/>
- NASA Voyager 3D model: <https://science.nasa.gov/resource/voyager-3d-model/>
- NASA Hubble Space Telescope 3D model: <https://science.nasa.gov/resource/hubble-space-telescope-3d-model/>
- NASA James Webb Space Telescope 3D models: <https://science.nasa.gov/mission/webb/multimedia/3d-models/>
- NASA Blue Marble: <https://visibleearth.nasa.gov/images/74218/december-blue-marble-next-generation/74226l>
- NASA Blue Marble clouds: <https://visibleearth.nasa.gov/images/57747/blue-marble-clouds>
- NASA Scientific Visualization Studio Moon kit: <https://svs.gsfc.nasa.gov/4720/>
- NASA/JPL Photojournal: <https://photojournal.jpl.nasa.gov/>
- NASA PDS Cassini ISS global maps: <https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn:nasa:pds:co_iss_global-maps&version=1.0>
- NASA Cassini panoramic rings: <https://science.nasa.gov/resource/panoramic-rings/>
- NASA PDS Ring-Moon Systems Node Uranus ring dimensions and optical depths: <https://pds-rings.seti.org/uranus/uranus_rings_table.html>
- NASA PDS Ring-Moon Systems Node Jupiter ring dimensions and optical depths: <https://pds-rings.seti.org/jupiter/jupiter_rings_table.html>
- NASA PDS Ring-Moon Systems Node Neptune ring dimensions, optical depths, and arcs: <https://pds-rings.seti.org/neptune/neptune_rings_table.html>
- NASA Uranus ring colours and ordering: <https://science.nasa.gov/uranus/facts/>
- USGS Astrogeology planetary maps: <https://astrogeology.usgs.gov/>
- NASA International Space Station facts and dimensions: <https://www.nasa.gov/international-space-station/space-station-facts-and-figures/>
- CelesTrak ISS current GP data: <https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON-PRETTY>
- NASA/JPL Horizons Tesla Roadster solution `-143205`: <https://ssd.jpl.nasa.gov/horizons/>
- NASA Apollo by the Numbers landing coordinates: <https://www.nasa.gov/wp-content/uploads/static/history/afj/pdf/abtn-202402.pdf>
- LROC Apollo spatio-temporal mapping datasets: <https://data.lroc.im-ldi.com/lroc/rdr_product_select>
- LROC Apollo PDS traverse CSV snapshots: <https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/SHAPEFILE/>
- NASA Apollo Lunar Surface Journal: <https://www.nasa.gov/history/alsj/>

The local authority asset manifests record every image source page, direct asset URL, presentation classification, coverage, projection, limitation, source and output dimension, byte length, content type, and SHA-256 checksum, plus each installed spacecraft model source, checksum, and physical maximum dimension.
NASA imagery is generally not copyrighted in the United States, but NASA identifiers, people, and third-party material can have additional restrictions.
Users redistributing these assets should follow the NASA media usage guidelines: <https://www.nasa.gov/nasa-brand-center/images-and-media/>.

## Fictional references

The Jovian Monolith and two Death Star visualizations are original procedural fan-reference models.
No Lucasfilm, Disney, MGM, or Warner Bros model or texture asset is included.
The Death Star names and designs remain the property of Lucasfilm Ltd.; their official descriptive references are the Star Wars Databank pages.
The installed stations are clearly labelled fictional, use hypothetical massless two-body paths, and do not affect the physical Solar System simulation.

- Death Star: <https://www.starwars.com/databank/death-star>
- Death Star II: <https://www.starwars.com/databank/death-star-ii>

## ESA Hipparcos catalogue

The local visible-star snapshot is derived from the ESA Hipparcos Catalogue and the CDS VizieR `I/239` catalogue service.

- ESA catalogue information: <https://www.cosmos.esa.int/web/hipparcos/catalogues>
- VizieR catalogue: <https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I/239>
- VizieR service DOI: <https://doi.org/10.26093/cds/vizier>

The Hipparcos and Tycho Catalogues are distributed under the Creative Commons Attribution-NonCommercial 3.0 IGO licence.
The catalogue data remains subject to that source licence and is not relicensed under the application GPL.
Required catalogue credit: `Credit: ESA`.
VizieR requests acknowledgement of the VizieR catalogue access tool, CDS, Strasbourg, France, with DOI `10.26093/cds/vizier`.
