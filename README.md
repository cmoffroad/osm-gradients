OSM Gradients
=========

Generate KML and GeoJSON gradients layers using OpenStreetMap data.

Derived from the excellent work of https://github.com/perliedman/osm-slope.

# Setup

	git clone git@github.com:cmoffroad/osm-gradients.git
	curl https://get.volta.sh | bash
	npm install

# Usage
	
	npx osm-gradients [options]

	Options:

	-i, --input <path>              Path to the OSM input file (*.osm.pbf)
	-s, --stops <percentages...>    Gradient percentage stops used to categorize elevation (comma-separated, e.g., "0 15 20 25 30 35 40")
	-c, --colors <colors...>        CSS Colors used to render elevation categories (comma-separated, e.g., "green yellow orange red purple brown black"). Number of elements must match `stops`.
	-f, --filters <filters...>      Overpass Query to filter input ways (e.g. '[highway=path])')
	-k, --kml <path>                Output file path for the KML layers. (*.kml). Default is the input file path with .kml extension
	-g, --geojson <path>            Output file path for the GeoJSON layers. (*.geojson). Default is the input file path with .geojson extension
	-x, --open                      Automatically open KML output file
	-d, --cache [directory]         Directory path to store SRTM elevation tiles (default: "./tmp/")
	-w, --width [pixels]            The width of the gradient lines. (default: 2)
  	-o, --opacity [float]           The opacity of the gradient lines. (default: 1.0)

## Example

	npx osm-gradients \
		-i data/chiangmai-231126.osm.pbf \
		-k data/chiangmai-231126-paths.kml \
		-s 0 15 20 25 30 35 40 \
		-c green yellow orange red purple brown black \
		-f '[highway=path]' \
		-w 2
		-o 1.0
		-x

![](./docs/screenshot.png)

# Limitations

- The `osmium` dependency necessitates an outdated Node.js version and a C++ compiler (XCode on OSX).
- Supported Overpass query filters are restricted and lack documentation.

# Contribute

If you discover value in this package, don't hesitate to contribute by submitting issues and pull requests.