#!/usr/bin/env node

const status = require('node-status');
const { program } = require('commander');

const package = require('../package.json');

const {
  countWays,
  createCategories,
  createQuery,
  createGeoJSON,
  exportGeoJSON,
  exportKML,
  openFile,
  processWays
} = require('./lib');

////////////////////////////////////////////////////////////////////////////////////////

console = status.console();

program
  .name(package.name)
  .version(package.version)
  .description(package.description)
  .requiredOption('-i, --input <path>', 'Path to the OSM input file (*.osm.pbf)')
  .requiredOption('-s, --stops <percentages...>', 'Gradient percentage stops used to categorize elevation (comma-separated, e.g., "0 15 20 25 30 35 40")', (val, r) => r.concat(parseInt(val)), [])
  .requiredOption('-c, --colors <colors...>', 'CSS Colors used to render elevation categories (comma-separated, e.g., "green yellow orange red purple brown black"). Number of elements must match `stops`.')
  .requiredOption('-f, --filters <filters...>', 'Overpass Query to filter input ways (e.g. way[highway=path][~"sac_scale|mtb:scale"~"."])')
  .option('-k, --kml <path>', 'Output file path for the KML layers. (*.kml). Default is the input file path with .kml extension')
  .option('-g, --geojson <path>', 'Output file path for the GeoJSON layers. (*.geojson). Default is the input file path with .geojson extension')
  .option('-x, --open', 'Automatically open KML output file')
  .option('-d, --cache [directory]', 'Directory path to store SRTM elevation tiles (default: "./tmp/")', './tmp/')
  .option('-w, --width [pixels]', 'The width of the gradient lines. (default: 2)', (val) => parseInt(val), 2)
  .option('-o, --opacity [float]', 'The opacity of the gradient lines. (default: 1.0)', (val) => parseFloat(val), 1.0)
  .parse(process.argv);

const command = `npx osm-gradients ${process.argv.slice(2).join(' ')}`

////////////////////////////////////////////////////////////////////////////////////

const { input, geojson, kml, cache, stops, colors, filters, open, width, opacity } = program.opts();

status.start({
  pattern: ` {spinner.cyan} {uptime.yellow} | Ways: {count.default.green} | {process.bar.cyan} {process.percentage.green}`,
  precision: 0
});

const categories = createCategories(stops, colors, width, opacity);
const query = createQuery(filters);

console.log(query)

countWays(status.addItem('count'), input, query, (max) => {

  processWays(status.addItem('process', { max }), input, query, categories, cache, (wayGradientsMap) => {
    const data = createGeoJSON(categories, wayGradientsMap);

    const pathGeoJSON = geojson || input.replace(/\.osm\.pbf$/, '.geojson');
    exportGeoJSON(pathGeoJSON, data);

    const pathXML = kml || input.replace(/\.osm\.pbf$/, '.kml');
    exportKML(pathXML, data, command);
    if (open) {
      openFile(pathXML)
    }

    process.exit(0);
  });
});