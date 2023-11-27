#!/usr/bin/env node

const status = require('node-status');
const { program } = require('commander');

const package = require('../package.json');

const {
  countWays,
  createQuery,
  createGeoJSON,
  exportGeoJSON,
  exportKML,
  createCategories,
  processWays
} = require('./lib');

////////////////////////////////////////////////////////////////////////////////////////

console = status.console();

program
  .name(package.name)
  .version(package.version)
  .description(package.description)
  .requiredOption('-i, --input <path>', 'Path to the OSM input file (*.osm.pbf)')
  .requiredOption('-k, --kml <path>', 'Output file path for the KML layers. (*.kml)')
  .requiredOption('-s, --stops <percentages...>', 'Gradient percentage stops used to categorize elevation (comma-separated, e.g., "0 15 20 25 30 35 40")', (val, r) => r.concat(parseInt(val)), [])
  .requiredOption('-c, --colors <colors...>', 'CSS Colors used to render elevation categories (comma-separated, e.g., "green yellow orange red purple brown black"). Number of elements must match `stops`.')
  .requiredOption('-f, --filter <filter>', 'Overpass Query to filter input ways (e.g. way[highway=path][~"sac_scale|mtb:scale"~"."])')
  .option('-d, --cache [directory]', 'Directory path to store SRTM elevation tiles (default: "./tmp/")', './tmp/')
  .option('-g, --geojson <path>', 'Output file path for the GeoJSON layers. (*.geojson)')
  .parse(process.argv);

const command = `npx osm-gradients ${process.argv.slice(2).join(' ')}`

////////////////////////////////////////////////////////////////////////////////////

const { input, geojson, kml, cache, stops, colors, filter } = program.opts();

status.start({
  pattern: ` {spinner.cyan} {uptime.yellow} | Ways: {count.default.green} | {process.bar.cyan} {process.percentage.green}`,
  precision: 0
});

const categories = createCategories(stops, colors);
const query = createQuery(filter);

countWays(status.addItem('count'), input, query, (max) => {

  processWays(status.addItem('process', { max }), input, query, categories, cache, (wayGradientsMap) => {
    const data = createGeoJSON(categories, wayGradientsMap);
    if (geojson)
      exportGeoJSON(geojson, data);
    if (kml)
      exportKML(kml, data, command);
    
    process.exit(0);
  });
});