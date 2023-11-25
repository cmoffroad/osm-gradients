const status = require('node-status');
const { program } = require('commander');

const package = require('../package.json');

const {
  countWays,
  createQuery,
  exportGeoJSON,
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
  .requiredOption('-o, --output <path>', 'Output file path for the GeoJSON layers. (*.geojson)')
  .requiredOption('-d, --cache [directory]', 'Directory path to store SRTM elevation tiles (e.g.: "./tmp/")')
  .requiredOption('-s, --stops <percentages...>', 'Gradient percentage stops used to categorize elevation (comma-separated, e.g., "0 15 20 25 30 35 40")', (val, r) => r.concat(parseInt(val)), [])
  .requiredOption('-c, --colors <colors...>', 'Colors used to render elevation categories (comma-separated, e.g., "green yellow orange red purple brown black"). Number of elements must match `stops`.')
  .requiredOption('-f, --filter <filter>', 'Overpass Query to filter input ways (e.g. way[highway=path][~"sac_scale|mtb:scale"~"."])');

program.parse(process.argv);

////////////////////////////////////////////////////////////////////////////////////

const { input, output, cache, stops, colors, filter } = program.opts();

status.start({
  pattern: ` {spinner.cyan} {uptime.yellow} | Ways: {count.default.green} | {process.bar.cyan} {process.percentage.green}`,
  precision: 0
});

const categories = createCategories(stops, colors);
const query = createQuery(filter);

countWays(status.addItem('count'), input, query, (max) => {

  processWays(status.addItem('process', { max }), input, query, categories, cache, (wayGradientsMap) => {
    exportGeoJSON(output, categories, wayGradientsMap);
    process.exit(0);
  });
});