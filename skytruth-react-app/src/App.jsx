import { useState, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import "./App.css";
const MAPBOX_TOKEN = import.meta.env.VITE_APP_MAPBOX_TOKEN;
const OUTDOORS_TOKEN = import.meta.env.VITE_APP_OUTDOORS_TOKEN;

const fetchEarthquakesData = async (bounds) => {
  try {
    const response = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?basicmagnitude=&minmagnitude=2.5&maxmagnitude=10&starttime=2022-01-01&endtime=2022-12-31&minlatitude=${
        bounds.getSouthWest().lat
      }&maxlatitude=${bounds.getNorthEast().lat}&minlongitude=${
        bounds.getSouthWest().lng
      }&maxlongitude=${bounds.getNorthEast().lng}&format=geojson`
    );

    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Error fetching earthquake data:", error);
    return null;
  }
};

function App() {
  const mapRef = useRef();
  const mapContainerRef = useRef();
  const popupRef = useRef(new mapboxgl.Popup({ closeOnClick: true }));

  const [mapLoaded, setMapLoaded] = useState(false);
  const [layersVisibility, setLayersVisibility] = useState({
    earthquakes: false,
    outdoors: false,
  });

  const toggleLayer = useCallback((layer) => {
    setLayersVisibility((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  }, []);

  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-98.5795, 39.8283],
      zoom: 4,
    });

    mapRef.current.on("load", async () => {
      setMapLoaded(true);

      // add outdoors layer
      mapRef.current.addSource("outdoors", {
        type: "raster",
        tiles: [
          `https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${OUTDOORS_TOKEN}`,
        ],
        tileSize: 256,
      });

      mapRef.current.addLayer({
        id: "outdoors-layer",
        type: "raster",
        source: "outdoors",
        layout: {
          visibility: "none",
        },
      });

      // initial load of earthquakes in bounding box
      const bounds = mapRef.current?.getBounds();

      const initialEarthquakeData = await fetchEarthquakesData(bounds);

      mapRef.current.addSource("earthquakes", {
        type: "geojson",
        data: initialEarthquakeData,
      });

      mapRef.current.addLayer({
        id: "earthquakes-layer",
        type: "circle",
        source: "earthquakes",
        paint: {
          "circle-radius": 4,
          "circle-color": "#B42222",
        },
        layout: {
          visibility: "none",
        },
        filter: ["==", "$type", "Point"],
      });

      mapRef.current.on("click", "earthquakes-layer", (e) => {
        if (popupRef.current.isOpen()) {
          // should this be moved to the useEffect cleanup?
          popupRef.current.remove(); // right now I am removing the popup on every click and re-adding it later on
        }

        // center map on clicked earthquake point
        mapRef.current.flyTo({
          center: e.features[0].geometry.coordinates,
        });

        const { mag, time } = e.features[0].properties;
        const dateString = new Date(time).toLocaleString();

        popupRef.current
          .setLngLat(e.features[0].geometry.coordinates)
          .setHTML(
            `<strong>Magnitude:</strong> ${mag}<br><strong>Date:</strong> ${dateString}`
          )
          .addTo(mapRef.current);
      });

      // make pointer show when hovering over earthquake points
      mapRef.current.on("mouseenter", "earthquakes-layer", () => {
        mapRef.current.getCanvas().style.cursor = "pointer";
      });

      mapRef.current.on("mouseleave", "earthquakes-layer", () => {
        mapRef.current.getCanvas().style.cursor = "";
      });
    });

    // fetch on moving map around with updated bounds
    mapRef.current.on("moveend", async () => {
      const updatedBounds = mapRef.current?.getBounds();
      // should be debouncing this query
      const earthquakeData = await fetchEarthquakesData(updatedBounds);

      if (earthquakeData) {
        mapRef.current.getSource("earthquakes").setData(earthquakeData);
      }
    });

    // clean up map on unmounting
    return () => {
      mapRef.current.remove();

      mapRef.current.off("moveend");
      mapRef.current.off("click", "earthquakes-layer");
      mapRef.current.off("mouseenter", "earthquakes-layer");
      mapRef.current.off("mouseleave", "earthquakes-layer");
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded) return;

    if (mapRef.current.getLayer("earthquakes-layer")) {
      mapRef.current.setLayoutProperty(
        "earthquakes-layer",
        "visibility",
        layersVisibility.earthquakes ? "visible" : "none"
      );
    }

    if (mapRef.current.getLayer("outdoors-layer")) {
      mapRef.current.setLayoutProperty(
        "outdoors-layer",
        "visibility",
        layersVisibility.outdoors ? "visible" : "none"
      );
    }
  }, [layersVisibility, mapLoaded]);

  return (
    <>
      <div id="sidebar" className="sidebar">
        <h2>Layers</h2>
        <label className="sidebar-item">
          Earthquakes
          <input
            type="checkbox"
            checked={layersVisibility["earthquakes"]}
            onChange={() => {
              toggleLayer("earthquakes");
            }}
          />
        </label>
        <label className="sidebar-item">
          Outdoors
          <input
            type="checkbox"
            checked={layersVisibility["outdoors"]}
            onChange={() => {
              toggleLayer("outdoors");
            }}
          />
        </label>
      </div>

      <div
        id="map-container"
        style={{ height: "100%" }}
        ref={mapContainerRef}
      />
    </>
  );
}

export default App;
