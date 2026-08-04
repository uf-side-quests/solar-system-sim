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

## NASA and JPL data and imagery

Major-body initial states and the permanent regression reference states are NASA/JPL Horizons data.
Authority-published gravitational parameters and rotation models are taken from JPL NAIF generic kernels.

- Horizons: <https://ssd.jpl.nasa.gov/horizons/>
- JPL planetary-satellite ephemerides: <https://ssd.jpl.nasa.gov/sats/ephem/>
- NAIF DE440 gravitational parameters: <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de440.tpc>
- NAIF planetary constants: <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc>
- NASA 3D Resources: <https://science.nasa.gov/3d-resources/>
- NASA Blue Marble: <https://visibleearth.nasa.gov/images/74218/december-blue-marble-next-generation/74226l>
- NASA Blue Marble clouds: <https://visibleearth.nasa.gov/images/57747/blue-marble-clouds>
- NASA Scientific Visualization Studio Moon kit: <https://svs.gsfc.nasa.gov/4720/>
- NASA/JPL Photojournal: <https://photojournal.jpl.nasa.gov/>
- NASA PDS Cassini ISS global maps: <https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn:nasa:pds:co_iss_global-maps&version=1.0>
- NASA Cassini panoramic rings: <https://science.nasa.gov/resource/panoramic-rings/>
- USGS Astrogeology planetary maps: <https://astrogeology.usgs.gov/>
- NASA International Space Station facts and dimensions: <https://www.nasa.gov/international-space-station/space-station-facts-and-figures/>
- CelesTrak ISS current GP data: <https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON-PRETTY>

The local authority asset manifest records every source page, direct asset URL, presentation classification, coverage, projection, limitation, source and output dimension, byte length, content type, and SHA-256 checksum.
NASA imagery is generally not copyrighted in the United States, but NASA identifiers, people, and third-party material can have additional restrictions.
Users redistributing these assets should follow the NASA media usage guidelines: <https://www.nasa.gov/nasa-brand-center/images-and-media/>.

## ESA Hipparcos catalogue

The local visible-star snapshot is derived from the ESA Hipparcos Catalogue and the CDS VizieR `I/239` catalogue service.

- ESA catalogue information: <https://www.cosmos.esa.int/web/hipparcos/catalogues>
- VizieR catalogue: <https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I/239>
- VizieR service DOI: <https://doi.org/10.26093/cds/vizier>

The Hipparcos and Tycho Catalogues are distributed under the Creative Commons Attribution-NonCommercial 3.0 IGO licence.
The catalogue data remains subject to that source licence and is not relicensed under the application GPL.
Required catalogue credit: `Credit: ESA`.
VizieR requests acknowledgement of the VizieR catalogue access tool, CDS, Strasbourg, France, with DOI `10.26093/cds/vizier`.
