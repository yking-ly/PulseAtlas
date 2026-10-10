"use client";

import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { countryFocus } from "@/lib/country-location.mjs";
import type { NewsEvent, ViewMode } from "@/lib/news-data";

type GlobeCanvasProps = {
  events: NewsEvent[];
  selectedId: string;
  viewMode: ViewMode;
  focusCountry?: string;
  showZoomControls?: boolean;
  onSelect: (event: NewsEvent) => void;
};

type Projected = { x: number; y: number; z: number };
type HitPoint = Projected & { event: NewsEvent };

const WORLD = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const COUNTRIES = feature(WORLD, WORLD.objects.countries);
const COASTLINES = mesh(WORLD, WORLD.objects.countries, (a, b) => a === b);
const COUNTRY_BORDERS = mesh(WORLD, WORLD.objects.countries, (a, b) => a !== b);
const GRATICULE = geoGraticule10();
const SPHERE = { type: "Sphere" } as const;

const COLORS = {
  positive: "#58f0ce",
  neutral: "#ffd166",
  negative: "#ff6b78",
};

export function GlobeCanvas({ events, selectedId, viewMode, focusCountry, showZoomControls = false, onSelect }: GlobeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef({ lng: -74, lat: 12 });
  const focusRef = useRef<ReturnType<typeof countryFocus>>(null);
  const focusUntilRef = useRef(0);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const hitPointsRef = useRef<HitPoint[]>([]);
  const [hovered, setHovered] = useState<HitPoint | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    focusRef.current = countryFocus(focusCountry);
    focusUntilRef.current = performance.now() + 1800;
  }, [focusCountry, events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      width = box.width;
      height = box.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const projection = geoOrthographic().clipAngle(90).precision(0.35);
    const path = geoPath(projection, context);

    const draw = (time: number) => {
      const focus = focusRef.current;
      if (!draggingRef.current && focus && time < focusUntilRef.current) {
        const targetLng = -focus.longitude;
        const deltaLng = ((targetLng - rotationRef.current.lng + 540) % 360) - 180;
        if (reducedMotion) {
          rotationRef.current = { lng: targetLng, lat: focus.latitude };
          focusUntilRef.current = 0;
        } else {
          rotationRef.current.lng += deltaLng * 0.09;
          rotationRef.current.lat += (focus.latitude - rotationRef.current.lat) * 0.09;
        }
      } else if (!draggingRef.current && !reducedMotion) {
        rotationRef.current.lng += 0.03;
      }
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width * 0.39, height * 0.43, 360) * zoom;
      const cx = width / 2;
      const cy = height * 0.48;
      const rotation = rotationRef.current;
      projection
        .translate([cx, cy])
        .scale(radius)
        .rotate([rotation.lng, -rotation.lat, 0]);

      const halo = context.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.28);
      halo.addColorStop(0, "rgba(34, 211, 238, .08)");
      halo.addColorStop(0.7, "rgba(34, 211, 238, .04)");
      halo.addColorStop(1, "rgba(34, 211, 238, 0)");
      context.fillStyle = halo;
      context.beginPath();
      context.arc(cx, cy, radius * 1.28, 0, Math.PI * 2);
      context.fill();

      const ocean = context.createRadialGradient(cx - radius * 0.28, cy - radius * 0.34, radius * 0.1, cx, cy, radius);
      ocean.addColorStop(0, "#123544");
      ocean.addColorStop(0.54, "#09232f");
      ocean.addColorStop(1, "#031019");
      context.fillStyle = ocean;
      context.beginPath();
      path(SPHERE);
      context.fill();

      context.save();
      context.beginPath();
      path(SPHERE);
      context.clip();

      context.strokeStyle = "rgba(116, 227, 226, .10)";
      context.lineWidth = 0.8;
      context.beginPath();
      path(GRATICULE);
      context.stroke();

      context.fillStyle = "rgba(48, 145, 140, .18)";
      context.beginPath();
      path(COUNTRIES);
      context.fill();

      if (focus) {
        context.fillStyle = "rgba(88, 240, 206, .2)";
        context.strokeStyle = "rgba(88, 240, 206, .95)";
        context.lineWidth = 1.7;
        context.beginPath();
        path(focus.feature);
        context.fill();
        context.stroke();
      }

      context.strokeStyle = "rgba(111, 238, 216, .66)";
      context.lineWidth = 1.05;
      context.beginPath();
      path(COASTLINES);
      context.stroke();

      context.strokeStyle = "rgba(120, 222, 211, .31)";
      context.lineWidth = 0.55;
      context.beginPath();
      path(COUNTRY_BORDERS);
      context.stroke();

      const visible = events
        .map((event) => {
          const location: [number, number] = [event.lng, event.lat];
          const projected = projection(location);
          const distance = geoDistance([-rotation.lng, rotation.lat], location);
          if (!projected || distance >= Math.PI / 2 - 0.02) return null;
          return {
            x: projected[0],
            y: projected[1],
            z: Math.cos(distance),
            event,
          };
        })
        .filter((point): point is HitPoint => point !== null)
        .sort((a, b) => a.z - b.z);
      hitPointsRef.current = visible;

      for (const point of visible) {
        const color = COLORS[point.event.sentiment];
        const strength = Math.min(1, 0.35 + point.event.sourceCount / 35);
        if (viewMode === "heatmap") {
          const heatRadius = 20 + point.event.sourceCount * 0.85;
          const heat = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, heatRadius);
          heat.addColorStop(0, `${color}cc`);
          heat.addColorStop(0.28, `${color}65`);
          heat.addColorStop(1, `${color}00`);
          context.globalCompositeOperation = "lighter";
          context.fillStyle = heat;
          context.beginPath();
          context.arc(point.x, point.y, heatRadius, 0, Math.PI * 2);
          context.fill();
          context.globalCompositeOperation = "source-over";
        } else {
          context.shadowColor = color;
          context.shadowBlur = 14 * strength;
          context.fillStyle = color;
          context.beginPath();
          context.arc(point.x, point.y, selectedId === point.event.id ? 5.5 : 3.2 + strength, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
          if (selectedId === point.event.id) {
            context.strokeStyle = color;
            context.lineWidth = 1.5;
            context.beginPath();
            context.arc(point.x, point.y, 11, 0, Math.PI * 2);
            context.stroke();
          }
        }
      }
      context.restore();

      context.strokeStyle = "rgba(122, 239, 221, .45)";
      context.lineWidth = 1.4;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = "rgba(122, 239, 221, .12)";
      context.beginPath();
      context.arc(cx, cy, radius + 7, 0, Math.PI * 2);
      context.stroke();

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [events, selectedId, viewMode, zoom]);

  function nearest(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: HitPoint | null = null;
    let distance = 24;
    for (const point of hitPointsRef.current) {
      const next = Math.hypot(point.x - x, point.y - y);
      if (next < distance) {
        distance = next;
        best = point;
      }
    }
    return best;
  }

  return (
    <div className="globe-stage" aria-label="Interactive globe showing geolocated news events">
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          draggingRef.current = true;
          movedRef.current = false;
          pointerRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          if (draggingRef.current) {
            const dx = event.clientX - pointerRef.current.x;
            const dy = event.clientY - pointerRef.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) movedRef.current = true;
            rotationRef.current.lng += dx * 0.28;
            rotationRef.current.lat = Math.max(-55, Math.min(55, rotationRef.current.lat - dy * 0.22));
            pointerRef.current = { x: event.clientX, y: event.clientY };
          } else {
            setHovered(nearest(event.clientX, event.clientY));
          }
        }}
        onPointerUp={(event) => {
          draggingRef.current = false;
          if (!movedRef.current) {
            const target = nearest(event.clientX, event.clientY);
            if (target) onSelect(target.event);
          }
        }}
        onPointerLeave={() => {
          draggingRef.current = false;
          setHovered(null);
        }}
      />
      {hovered && (
        <div className="globe-tooltip" style={{ left: hovered.x, top: hovered.y }}>
          <span>{hovered.event.location}</span>
          <strong>{hovered.event.title}</strong>
        </div>
      )}
      {showZoomControls && (
        <div className="globe-zoom-controls" role="group" aria-label="Globe zoom controls">
          <button type="button" onClick={() => setZoom((value) => Math.min(1.6, value + 0.2))} disabled={zoom >= 1.6} aria-label="Zoom in">
            <Plus aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))} disabled={zoom <= 0.6} aria-label="Zoom out">
            <Minus aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="globe-hint">Drag to rotate · select a pulse to inspect</div>
    </div>
  );
}
