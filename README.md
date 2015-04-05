OSM Slope
=========

Calculate slope (climb and descent) for highway ways in OSM data.

OSM Slope offers reasonable performance. Processing all of Sweden (825k highway ways)
takes 150 seconds on my pretty old laptop.

## Usage

Currently designed to be used as a commandline tool.

```
node index.js [--cache-dir &lt;DIR&gt;] &lt;INPUT&gt; &lt;OUTPUT&gt;
```

where `INPUT` is an OpenStreetMap `.osm.xml` or `.osm.pbf` file. Output
is a JSON file.

The output is organized as a map with way ids as keys and an object with
slope information in this format:

* `distance`: total way length in kilometers
* `climbDistance`: distance climbing (kilometers)
* `descentDistance`: distance descending (kilometers)
* `climb`: total climb (meters)
* `descent`: total descent (meters)
