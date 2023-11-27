const fs = require('fs');
const async = require('async');
const osmium = require('osmium');
const hgt = require('node-hgt');
const haversine = require('haversine');
const tokml = require('tokml');

const colorsMap = require('./colors');

const PATTERN_KEY = '([^!=~]+)';
const PATTERN_VALUE = PATTERN_KEY;

function createQuery (filter) {
  return filter
    .split(/\]|\[/)
    .filter(s => s.length)
    .map(i =>  {
      let m;
      if (m = i.match(`^${PATTERN_KEY}$`)) {  
        /* exists */ return `( o.tags["${m[1]}"] !== undefined )`;
      } else if (m = i.match(`^!${PATTERN_KEY}$`)) { 
        /* not exist */ return `( o.tags["${m[1]}"] === undefined )`;
      } else if (m = i.match(`^${PATTERN_KEY}=${PATTERN_VALUE}$`)) {
        /* equals */ return `( o.tags["${m[1]}"] == "${m[2]}" )`;
      } else if (m = i.match(`^${PATTERN_KEY}!=${PATTERN_VALUE}$`)) {
        /* note equals */ return `( o.tags["${m[1]}"] !== undefined && o.tags["${m[1]}"] != "${m[2]}" )`;
      } else if (m = i.match(`^${PATTERN_KEY}~${PATTERN_VALUE}$`)) {
        /* matches value */ return `( o.tags["${m[1]}"] !== undefined && o.tags["${m[1]}"].match("${m[2]}") )`;
      } else if (m = i.match(`^${PATTERN_KEY}!~${PATTERN_VALUE}$`)) {
        /* not match value */ return `( o.tags["${m[1]}"] !== undefined && !o.tags["${m[1]}"].match("${m[2]}") )`;
      } else if (m = i.match(`^~${PATTERN_KEY}~${PATTERN_VALUE}$`)) {
        /* matches key value */ return `( Object.keys(o.tags).some(k => k.match("${m[1]}") && o.tags[k].match("${m[2]}")) )`;
      } else {
        return `false`
      }
    })
    .join(` && `);
}

const evalObject = (o, template) => {
  return eval(template);
};

const createCategories = function (stops, colors) {
  return stops.reduce((result, stop, index) => {
    const currentStop = stop;
    const nextStop = stops[index + 1] || 100;
    const currentColor = colors[index];
    
    result.push({
      min: currentStop,
      max: nextStop,
      name: nextStop === 100 ? `> ${currentStop}%` : `${currentStop}-${nextStop}%`,
      stroke: colorsMap[currentColor] || currentColor
    });
  
    return result;
  }, []);
};

const initializeGradients = function (length) {
  return Array.from({ length }, () => new Array());
};

const fillNodeElevations = function (coords, tileSet, categories, cb) {
  let wait = coords.length;

  coords.forEach((c) => {
    tileSet.getElevation(c, (err, elevation) => {
      if (!err) {
        c.elevation = elevation;
        wait--;
      } else {
        cb(err);
        return;
      }

      if (wait === 0) {
        cb(null, coords, categories);
      }
    });
  });
};

 const collectWayGradients = (coords, categories, cb) => {
  const wayGradients = coords.reduce((accumulator, currentCoord) => {
    const data = accumulator.data;

    if (accumulator.lastCoord) {
      // Compute segment distance in meters using haversine
      const distance = haversine(accumulator.lastCoord, currentCoord, { format: '{lat,lng}' }) * 1000;
      // Compute segment gradient/slope % based on the last point
      const gradient = Math.abs(currentCoord.elevation - accumulator.lastElevation) / distance * 100;

      const categoryIndex = categories.findIndex(category => category.min <= gradient && gradient < category.max);
      if (categoryIndex !== -1) {
        const categoryGradients = data[categoryIndex];

        const previousCoords = [accumulator.lastCoord.lng, accumulator.lastCoord.lat ];
        const newCoords = [ currentCoord.lng, currentCoord.lat ];

        if (categoryIndex === accumulator.lastCategoryIndex) {
          categoryGradients[categoryGradients.length - 1].push(newCoords)
        } else {
          categoryGradients.push([ previousCoords, newCoords ]);
        }
      }

      accumulator.lastCategoryIndex = categoryIndex;
    }

    accumulator.lastElevation = currentCoord.elevation;
    accumulator.lastCoord = currentCoord;

    return accumulator;
  }, {
    data: initializeGradients(categories.length),
    lastElevation: null,
    lastCoord: null,
    lastCategoryIndex: null
  }).data;

  cb(null, wayGradients);
};


const filterWay = (way, query) => {
  const object = {
    ...way, 
    tags: way.tags()
  };
  return object.type === 'way' && evalObject(object, query);
}

const processWays = (processWaysJob, input, query, categories, cache, cb) => {
  const file = new osmium.File(input);
  const reader = new osmium.Reader(file, { node: true, way: true });
  const locationHandler = new osmium.LocationHandler();
  const handler = new osmium.Handler();
  const tasks = [];
  const tileSet = new hgt.TileSet(cache);
  const wayGradientsMap = {};

  handler.on('way', way => {
    if (filterWay(way, query)) {
      try {
        const wayId = way.id;
        const coords = way.node_coordinates().map(c => ({ lat: c.lat, lng: c.lon }));
        
        tasks.push(cb => {
          processWaysJob.inc();
          async.waterfall([
            fillNodeElevations.bind(this, coords, tileSet, categories),
            collectWayGradients
          ], (err, wayGradients) => {
            if (err) {
              return cb(err);
            }
            wayGradientsMap[wayId] = wayGradients;
            cb(undefined, wayGradients);
          });
        });
      } catch (e) {
        console.warn(`Error for way ${way.id}: ${e.message}`);
        return;
      }
    }
  });

  const next = () => {
    tasks.length = 0;
    const buffer = reader.read();

    if (buffer) {
      osmium.apply(buffer, locationHandler, handler);
      async.parallelLimit(tasks, 4, err => {
        if (!err) {
          setImmediate(() => next());
        } else {
          console.error(err);
          process.exit(1);
        }
      });
    } else {
      cb(wayGradientsMap);
    }
  };

  next();
}

const countWays = (countWaysJob, input, query, cb) => {
  const file = new osmium.File(input);
  const reader = new osmium.Reader(file, { way: true });
  const handler = new osmium.Handler();
  let count = 0;

  handler.on('way', way => {
    if (filterWay(way, query)) {
      count++;
      countWaysJob.inc();
    }
  });

  const next = () => {
    const buffer = reader.read();
    if (buffer) {
      osmium.apply(buffer, handler);
      setImmediate(next);
    } else {
      cb(count);
    }
  };

  next();
};

const createGeoJSON = (categories, wayGradientsMap) => {
  let gradients = initializeGradients(categories.length);

  Object.entries(wayGradientsMap).forEach(([wayId, wayGradients]) => {
    wayGradients.forEach((points, index) => {
      gradients[index].push(...points);
    });
  });

  const geojson = {
    type: 'FeatureCollection',
    features: categories.map((category, index) => ({
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: gradients[index],
      },
      properties: category,
    })),
  };

  return geojson;
};

const exportGeoJSON = (path, geojson) => {
  fs.writeFileSync(path, JSON.stringify(geojson, null));
}

const exportKML = (path, geojson, command) => {
  const kml = tokml(geojson, {
    documentName: path,
    documentDescription: command,
    name: 'name',
    simplestyle: true
  });

  fs.writeFileSync(path, kml);
}

module.exports = {
  countWays,
  createGeoJSON,
  createQuery,
  createCategories,
  exportGeoJSON,
  exportKML,
  processWays
}