"use client";

import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { Layer, LayerGroup, Map as LMap } from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { LatLon, Ring } from "../lib/schema/geo";
import type { Waypoint } from "../lib/schema/mission";
import type { Poi } from "../lib/schema/scenario";
import { boundsOf, fromLeafletRing, toLatLngs } from "../lib/ui/geo";
import styles from "./MapView.module.css";

type NoFly = { id: string; name: string; ring: Ring };
type Leaflet = typeof import("leaflet");

export type MapViewProps = {
  tileUrl: string;
  home: LatLon;
  geofence: Ring;
  noFly: readonly NoFly[];
  area: Ring;
  editableArea: boolean;
  onAreaChange: (ring: Ring) => void;
  path: readonly Waypoint[];
  badWaypointIds: readonly string[];
  drone?: LatLon;
  pois: readonly Poi[];
};

const FENCE = { color: "#79b8ff", weight: 2, fill: false };
const NOFLY = {
  color: "#ff7b72",
  weight: 2,
  dashArray: "6 4",
  fillOpacity: 0.2,
};
const AREA = { color: "#56d364", weight: 2, fillOpacity: 0.1 };

export function MapView(props: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<{
    L: Leaflet;
    map: LMap;
    layers: LayerGroup;
  } | null>(null);
  const onAreaChange = useRef(props.onAreaChange);
  onAreaChange.current = props.onAreaChange;
  const fitted = useRef(false);

  // Create the map once; Leaflet and Geoman touch `window`, so import lazily.
  // biome-ignore lint/correctness/useExhaustiveDependencies: map is created once
  useEffect(() => {
    let cancelled = false;
    let map: LMap | undefined;
    (async () => {
      const mod = await import("leaflet");
      const L = (mod.default ?? mod) as Leaflet;
      await import("@geoman-io/leaflet-geoman-free");
      if (cancelled || !el.current) return;
      map = L.map(el.current).setView([props.home.lat, props.home.lon], 16);
      L.tileLayer(props.tileUrl, {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      setReady({ L, map, layers: L.layerGroup().addTo(map) });
    })().catch((e) => console.error("MapView init failed", e));
    return () => {
      cancelled = true;
      map?.remove();
      setReady(null);
      fitted.current = false;
    };
  }, []);

  // Redraw layers on prop change without recreating the map.
  useEffect(() => {
    if (!ready) return;
    const { L, map, layers } = ready;
    layers.clearLayers();
    L.polygon(toLatLngs(props.geofence), FENCE).addTo(layers);
    for (const z of props.noFly) {
      L.polygon(toLatLngs(z.ring), NOFLY)
        .bindTooltip(`No-fly: ${z.name}`, { permanent: true })
        .addTo(layers);
    }
    for (const p of props.pois) {
      L.circle([p.lat, p.lon], {
        radius: p.radius_m,
        color: "#e3b341",
        weight: 1,
      })
        .bindTooltip(p.label)
        .addTo(layers);
    }
    L.marker([props.home.lat, props.home.lon], {
      title: "Home",
      icon: L.divIcon({
        className: "",
        iconSize: [24, 24],
        html: '<div style="font-size:20px;line-height:24px;text-align:center">🏠</div>',
      }),
    })
      .bindTooltip("Home")
      .addTo(layers);
    L.polyline(
      props.path.map((w): [number, number] => [w.lat, w.lon]),
      { color: "#79b8ff", weight: 3 },
    ).addTo(layers);
    props.path.forEach((w, i) => {
      const bad = props.badWaypointIds.includes(w.id);
      L.marker([w.lat, w.lon], {
        title: bad
          ? `Waypoint ${i + 1} violates a constraint`
          : `Waypoint ${i + 1}`,
        icon: L.divIcon({
          className: "",
          iconSize: [24, 24],
          html: `<div class="${styles.wp} ${bad ? styles.bad : ""}">${bad ? "✗" : i + 1}</div>`,
        }),
      }).addTo(layers);
    });
    if (props.drone) {
      L.marker([props.drone.lat, props.drone.lon], {
        title: "Drone",
        icon: L.divIcon({
          className: "",
          iconSize: [24, 24],
          html: `<div class="${styles.drone}">🛸</div>`,
        }),
      }).addTo(layers);
    }
    const area = L.polygon(toLatLngs(props.area), AREA).addTo(layers);
    if (props.editableArea) {
      area.pm.enable({ allowSelfIntersection: false });
      area.on("pm:edit", () => {
        const ring = fromLeafletRing(
          (area.getLatLngs()[0] ?? []) as { lat: number; lng: number }[],
        );
        if (ring) onAreaChange.current(ring);
      });
    }
    if (!fitted.current) {
      const b = boundsOf([props.geofence, props.area]);
      if (b) map.fitBounds(b, { padding: [16, 16] });
      fitted.current = true;
    }
    return () => {
      area.off("pm:edit");
      layers.eachLayer((l: Layer) => l.off());
    };
  }, [ready, props]);

  return (
    <div
      ref={el}
      className={styles.map}
      role="application"
      aria-label="Mission map: geofence, no-fly zones, area, path and drone"
    />
  );
}
