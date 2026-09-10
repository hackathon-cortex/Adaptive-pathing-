import { useState, useMemo, useEffect, useRef } from "react";
import {
  Car,
  Compass,
  BarChart3,
  GitBranch,
  Layers,
  Settings2,
  Sun,
  Moon,
  Radio,
  Camera,
  Activity,
  Navigation,
  Eye,
  CheckCircle2,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  Shield,
  Zap,
  CloudRain
} from "lucide-react";
import "./App.css";

/* =========================================================
   SCENARIO DATA (PRESERVED VERBATIM + STATIC DEMO TELEMETRY)
========================================================= */

const scenarioData = {
  "Normal Driving": {
    speed: 42,
    mode: "CRUISE",
    risk: "LOW",
    clearance: "3.8 m",
    riskScore: 18,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "42 ms",
    collision: "0",
    completion: "100%",
    minClearance: "3.8 m",
    smoothness: "0.94",
    acceleration: "0.15 m/s²",
    steering: "0.0°",
    throttle: "28%",
    brake: "0%",
    ttc: "5.2 s",
    eventTitle: "NOMINAL CORRIDOR FOLLOWING",
    decision: "MAINTAIN VELOCITY & LANE CENTER",
    category: "NORMAL",
  },

  "Pedestrian Crossing": {
    speed: 28,
    mode: "CAUTION",
    risk: "MEDIUM",
    clearance: "2.1 m",
    riskScore: 48,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "58 ms",
    collision: "0",
    completion: "100%",
    minClearance: "2.1 m",
    smoothness: "0.87",
    acceleration: "-1.85 m/s²",
    steering: "-2.4°",
    throttle: "12%",
    brake: "32%",
    ttc: "2.8 s",
    eventTitle: "PEDESTRIAN ON TRAVERSABLE PATH",
    decision: "MODERATE BRAKING & BIAS RIGHT",
    category: "INTERACTION",
  },

  "Vehicle Cut-In": {
    speed: 35,
    mode: "ADAPTIVE",
    risk: "HIGH",
    clearance: "1.7 m",
    riskScore: 72,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "71 ms",
    collision: "0",
    completion: "100%",
    minClearance: "1.7 m",
    smoothness: "0.82",
    acceleration: "-2.40 m/s²",
    steering: "4.8°",
    throttle: "8%",
    brake: "48%",
    ttc: "1.8 s",
    eventTitle: "ADJACENT VEHICLE CUT-IN DETECTED",
    decision: "LANE OFFSET RIGHT & DECELERATE",
    category: "INTERACTION",
  },

  "Sudden Obstacle": {
    speed: 22,
    mode: "EVASION",
    risk: "HIGH",
    clearance: "1.4 m",
    riskScore: 76,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "64 ms",
    collision: "0",
    completion: "100%",
    minClearance: "1.4 m",
    smoothness: "0.79",
    acceleration: "-3.10 m/s²",
    steering: "-6.2°",
    throttle: "0%",
    brake: "62%",
    ttc: "1.4 s",
    eventTitle: "STATIONARY ROAD OBSTACLE",
    decision: "QUICK SWERVE LEFT & BRAKE",
    category: "SAFETY",
  },

  "Emergency Braking": {
    speed: 12,
    mode: "EMERGENCY",
    risk: "CRITICAL",
    clearance: "0.9 m",
    riskScore: 92,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "38 ms",
    collision: "0",
    completion: "100%",
    minClearance: "0.9 m",
    smoothness: "0.68",
    acceleration: "-5.80 m/s²",
    steering: "0.0°",
    throttle: "0%",
    brake: "95%",
    ttc: "0.8 s",
    eventTitle: "CRITICAL PROXIMITY BREACH",
    decision: "MAXIMUM REGENERATIVE & ABS STOP",
    category: "SAFETY",
  },

  "Lane Change": {
    speed: 38,
    mode: "MANEUVER",
    risk: "MEDIUM",
    clearance: "2.6 m",
    riskScore: 42,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "52 ms",
    collision: "0",
    completion: "100%",
    minClearance: "2.6 m",
    smoothness: "0.91",
    acceleration: "0.45 m/s²",
    steering: "-3.8°",
    throttle: "35%",
    brake: "0%",
    ttc: "3.6 s",
    eventTitle: "PLANNED OVERTAKE MANEUVER",
    decision: "SMOOTH LATERAL LANE SHIFT LEFT",
    category: "NORMAL",
  },

  "Intersection Scenario": {
    speed: 25,
    mode: "CAUTION",
    risk: "HIGH",
    clearance: "1.8 m",
    riskScore: 68,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "69 ms",
    collision: "0",
    completion: "100%",
    minClearance: "1.8 m",
    smoothness: "0.83",
    acceleration: "-1.20 m/s²",
    steering: "1.5°",
    throttle: "15%",
    brake: "25%",
    ttc: "2.2 s",
    eventTitle: "UNSIGNALIZED CROSS-TRAFFIC",
    decision: "CREEP & YIELD TO TWO-WHEELER",
    category: "INTERACTION",
  },

  "High-Density Traffic": {
    speed: 18,
    mode: "CONGESTION",
    risk: "HIGH",
    clearance: "1.2 m",
    riskScore: 74,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "82 ms",
    collision: "0",
    completion: "100%",
    minClearance: "1.2 m",
    smoothness: "0.76",
    acceleration: "-0.60 m/s²",
    steering: "0.5°",
    throttle: "18%",
    brake: "22%",
    ttc: "1.6 s",
    eventTitle: "URBAN CONGESTION GRIDLOCK",
    decision: "STOP-AND-GO CAR FOLLOWING",
    category: "INTERACTION",
  },

  "Weather Conditions": {
    speed: 24,
    mode: "ADAPTIVE",
    risk: "MEDIUM",
    clearance: "2.3 m",
    riskScore: 54,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "61 ms",
    collision: "0",
    completion: "100%",
    minClearance: "2.3 m",
    smoothness: "0.85",
    acceleration: "-0.80 m/s²",
    steering: "-1.0°",
    throttle: "20%",
    brake: "15%",
    ttc: "3.1 s",
    eventTitle: "HEAVY PRECIPITATION & WET ROAD",
    decision: "EXTEND HEADWAY & LOWER SPEED",
    category: "ENVIRONMENT",
  },

  "Road Hazard": {
    speed: 20,
    mode: "EVASION",
    risk: "HIGH",
    clearance: "1.5 m",
    riskScore: 78,
    trajectory: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"],
    latency: "66 ms",
    collision: "0",
    completion: "100%",
    minClearance: "1.5 m",
    smoothness: "0.77",
    acceleration: "-2.80 m/s²",
    steering: "5.5°",
    throttle: "5%",
    brake: "55%",
    ttc: "1.5 s",
    eventTitle: "DEBRIS IN DRIVING LANE",
    decision: "SLALOM EVASION & SLOW PASS",
    category: "ENVIRONMENT",
  },
};

const birdViewData = {
  "Normal Driving": { vehicle: true, cutIn: false, pedestrian: false, bike: false, obstacle: false },
  "Pedestrian Crossing": { vehicle: false, cutIn: false, pedestrian: true, bike: false, obstacle: false },
  "Vehicle Cut-In": { vehicle: false, cutIn: true, pedestrian: false, bike: false, obstacle: false },
  "Sudden Obstacle": { vehicle: false, cutIn: false, pedestrian: false, bike: false, obstacle: true },
  "Emergency Braking": { vehicle: true, cutIn: false, pedestrian: false, bike: false, obstacle: true },
  "Lane Change": { vehicle: true, cutIn: false, pedestrian: false, bike: false, obstacle: false },
  "Intersection Scenario": { vehicle: false, cutIn: false, pedestrian: false, bike: true, obstacle: false },
  "High-Density Traffic": { vehicle: true, cutIn: true, pedestrian: false, bike: true, obstacle: false },
  "Weather Conditions": { vehicle: true, cutIn: false, pedestrian: false, bike: false, obstacle: false },
  "Road Hazard": { vehicle: false, cutIn: false, pedestrian: false, bike: false, obstacle: true },
};

const obstacleData = {
  "Normal Driving": [{ name: "Vehicle", distance: "18.4 m", speed: "38 km/h", risk: "LOW" }],
  "Pedestrian Crossing": [{ name: "Pedestrian", distance: "7.2 m", speed: "4 km/h", risk: "MEDIUM" }],
  "Vehicle Cut-In": [{ name: "Cut-in Vehicle", distance: "4.8 m", speed: "32 km/h", risk: "HIGH" }],
  "Sudden Obstacle": [{ name: "Road Obstacle", distance: "5.1 m", speed: "0 km/h", risk: "HIGH" }],
  "Emergency Braking": [{ name: "Lead Vehicle", distance: "3.2 m", speed: "0 km/h", risk: "CRITICAL" }],
  "Lane Change": [{ name: "Vehicle", distance: "14.0 m", speed: "34 km/h", risk: "LOW" }],
  "Intersection Scenario": [{ name: "Two-Wheeler", distance: "8.1 m", speed: "22 km/h", risk: "HIGH" }],
  "High-Density Traffic": [
    { name: "Vehicle Front", distance: "4.5 m", speed: "16 km/h", risk: "HIGH" },
    { name: "Vehicle Side", distance: "2.1 m", speed: "18 km/h", risk: "MEDIUM" },
  ],
  "Weather Conditions": [{ name: "Vehicle", distance: "16.8 m", speed: "22 km/h", risk: "MEDIUM" }],
  "Road Hazard": [{ name: "Road Hazard", distance: "6.0 m", speed: "0 km/h", risk: "HIGH" }],
};

const comparisonData = {
  "Normal Driving": {
    collision: { baseline: "0", adaptive: "0" },
    minClearance: { baseline: "2.8 m", adaptive: "3.8 m" },
    latency: { baseline: "85 ms", adaptive: "42 ms" },
    smoothness: { baseline: "0.81", adaptive: "0.94" },
    completion: { baseline: "98%", adaptive: "100%" },
  },
  "Pedestrian Crossing": {
    collision: { baseline: "1", adaptive: "0" },
    minClearance: { baseline: "0.8 m", adaptive: "2.1 m" },
    latency: { baseline: "92 ms", adaptive: "58 ms" },
    smoothness: { baseline: "0.72", adaptive: "0.87" },
    completion: { baseline: "90%", adaptive: "100%" },
  },
  "Vehicle Cut-In": {
    collision: { baseline: "1", adaptive: "0" },
    minClearance: { baseline: "0.6 m", adaptive: "1.7 m" },
    latency: { baseline: "110 ms", adaptive: "71 ms" },
    smoothness: { baseline: "0.65", adaptive: "0.82" },
    completion: { baseline: "85%", adaptive: "100%" },
  },
  "Sudden Obstacle": {
    collision: { baseline: "2", adaptive: "0" },
    minClearance: { baseline: "0.4 m", adaptive: "1.4 m" },
    latency: { baseline: "98 ms", adaptive: "64 ms" },
    smoothness: { baseline: "0.60", adaptive: "0.79" },
    completion: { baseline: "82%", adaptive: "100%" },
  },
  "Emergency Braking": {
    collision: { baseline: "2", adaptive: "0" },
    minClearance: { baseline: "0.2 m", adaptive: "0.9 m" },
    latency: { baseline: "88 ms", adaptive: "38 ms" },
    smoothness: { baseline: "0.55", adaptive: "0.68" },
    completion: { baseline: "75%", adaptive: "100%" },
  },
  "Lane Change": {
    collision: { baseline: "0", adaptive: "0" },
    minClearance: { baseline: "1.9 m", adaptive: "2.6 m" },
    latency: { baseline: "80 ms", adaptive: "52 ms" },
    smoothness: { baseline: "0.78", adaptive: "0.91" },
    completion: { baseline: "95%", adaptive: "100%" },
  },
  "Intersection Scenario": {
    collision: { baseline: "1", adaptive: "0" },
    minClearance: { baseline: "0.7 m", adaptive: "1.8 m" },
    latency: { baseline: "105 ms", adaptive: "69 ms" },
    smoothness: { baseline: "0.68", adaptive: "0.83" },
    completion: { baseline: "88%", adaptive: "100%" },
  },
  "High-Density Traffic": {
    collision: { baseline: "2", adaptive: "0" },
    minClearance: { baseline: "0.5 m", adaptive: "1.2 m" },
    latency: { baseline: "125 ms", adaptive: "82 ms" },
    smoothness: { baseline: "0.62", adaptive: "0.76" },
    completion: { baseline: "80%", adaptive: "100%" },
  },
  "Weather Conditions": {
    collision: { baseline: "1", adaptive: "0" },
    minClearance: { baseline: "1.2 m", adaptive: "2.3 m" },
    latency: { baseline: "95 ms", adaptive: "61 ms" },
    smoothness: { baseline: "0.70", adaptive: "0.85" },
    completion: { baseline: "92%", adaptive: "100%" },
  },
  "Road Hazard": {
    collision: { baseline: "2", adaptive: "0" },
    minClearance: { baseline: "0.5 m", adaptive: "1.5 m" },
    latency: { baseline: "102 ms", adaptive: "66 ms" },
    smoothness: { baseline: "0.64", adaptive: "0.77" },
    completion: { baseline: "84%", adaptive: "100%" },
  },
};

const getRiskClass = (risk) => {
  if (risk === "LOW") return "risk-box-low";
  if (risk === "MEDIUM") return "risk-box-medium";
  if (risk === "HIGH") return "risk-box-high";
  if (risk === "CRITICAL") return "risk-box-critical";
  return "";
};

/* =========================================================
   IMMERSIVE BIRD'S-EYE VIEW SVG
========================================================= */

function SpatialDriveView({ scenario, data, birdData, obstacles }) {
  const actors = useMemo(() => {
    const list = [];
    const obsDist = {};
    if (obstacles) {
      obstacles.forEach((obs) => {
        obsDist[obs.name.toLowerCase()] = obs.distance;
      });
    }

    list.push({
      id: "ego",
      type: "ego",
      x: 300,
      y: 430,
      width: 36,
      length: 64,
    });

    if (birdData.vehicle) {
      list.push({
        id: "lead_vehicle",
        type: "vehicle",
        label: `LEAD VEHICLE (${obsDist["vehicle"] || "15.6m"})`,
        x: 300,
        y: 190,
        width: 32,
        length: 56,
      });
    }

    if (birdData.cutIn) {
      list.push({
        id: "cutin_vehicle",
        type: "cutin",
        label: `CUT-IN (${obsDist["cut-in vehicle"] || "4.8m"})`,
        x: 230,
        y: 270,
        width: 30,
        length: 52,
      });
    }

    if (birdData.pedestrian) {
      list.push({
        id: "pedestrian",
        type: "pedestrian",
        label: `PEDESTRIAN (${obsDist["pedestrian"] || "7.2m"})`,
        x: 375,
        y: 305,
        width: 14,
        length: 14,
      });
    }

    if (birdData.bike) {
      list.push({
        id: "bike",
        type: "bike",
        label: `2-WHEELER (${obsDist["two-wheeler"] || "8.1m"})`,
        x: 385,
        y: 230,
        width: 16,
        length: 30,
      });
    }

    if (birdData.obstacle) {
      list.push({
        id: "obstacle",
        type: "obstacle",
        label: `HAZARD (${obsDist["road hazard"] || obsDist["road obstacle"] || "5.1m"})`,
        x: 320,
        y: 315,
        width: 24,
        length: 24,
      });
    }

    return list;
  }, [birdData, obstacles]);

  const trajectoryPoints = useMemo(() => {
    const points = [];
    const count = 10;
    const startX = 300;
    const startY = 420;

    let lateralOffset = 0;
    if (scenario === "Vehicle Cut-In" || scenario === "Sudden Obstacle") {
      lateralOffset = 55;
    } else if (scenario === "Lane Change") {
      lateralOffset = -80;
    } else if (scenario === "Pedestrian Crossing") {
      lateralOffset = -30;
    }

    for (let i = 0; i < count; i++) {
      const progress = (i + 1) / count;
      const ease = progress * progress * (3 - 2 * progress);
      const x = startX + lateralOffset * ease;
      const y = startY - progress * 330;
      points.push({ id: `T${i + 1}`, x, y });
    }
    return points;
  }, [scenario]);

  const pathD = useMemo(() => {
    if (trajectoryPoints.length === 0) return "";
    let d = `M 300 420`;
    trajectoryPoints.forEach((pt) => {
      d += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    });
    return d;
  }, [trajectoryPoints]);

  return (
    <svg className="spatial-bev-svg" viewBox="0 0 600 500" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="sensorCone" cx="50%" cy="100%" r="90%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="riskHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={data.risk === "CRITICAL" ? "#ef4444" : data.risk === "HIGH" ? "#f97316" : "#f59e0b"} stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Wide Road Canvas */}
      <rect x="100" y="0" width="400" height="500" fill="#18202d" rx="6" />
      <line x1="100" y1="0" x2="100" y2="500" stroke="#475569" strokeWidth="3" />
      <line x1="500" y1="0" x2="500" y2="500" stroke="#475569" strokeWidth="3" />

      {/* Lane dividers */}
      <line x1="300" y1="0" x2="300" y2="500" stroke="#cbd5e1" strokeWidth="2.5" strokeDasharray="16 14" />
      <line x1="200" y1="0" x2="200" y2="500" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeDasharray="8 10" />
      <line x1="400" y1="0" x2="400" y2="500" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeDasharray="8 10" />

      {/* Distance Arcs */}
      <ellipse cx="300" cy="430" rx="120" ry="110" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 6" />
      <text x="425" y="425" fill="rgba(255,255,255,0.4)" fontSize="10" className="mono">10m</text>

      <ellipse cx="300" cy="430" rx="210" ry="195" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 6" />
      <text x="475" y="340" fill="rgba(255,255,255,0.4)" fontSize="10" className="mono">20m</text>

      {/* Sensor Perception Cone */}
      <path d="M 300 420 L 140 120 A 240 240 0 0 1 460 120 Z" fill="url(#sensorCone)" />

      {/* Spatial Risk Zone Halo */}
      {data.risk !== "LOW" && (
        <circle
          cx={trajectoryPoints[4]?.x || 300}
          cy={trajectoryPoints[4]?.y || 280}
          r={data.risk === "CRITICAL" ? 75 : 55}
          fill="url(#riskHalo)"
        />
      )}

      {/* Planned Trajectory Corridor (Dominant Cyan Path) */}
      <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="4.5" strokeLinecap="round" />

      {/* Waypoints */}
      {trajectoryPoints.map((pt, idx) => (
        <g key={pt.id}>
          <circle cx={pt.x} cy={pt.y} r={idx === 9 ? 5 : 3.5} fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
          {(idx === 0 || idx === 4 || idx === 9) && (
            <text x={pt.x + 8} y={pt.y + 4} fill="#38bdf8" fontSize="10" fontWeight="bold" className="mono">
              {pt.id}
            </text>
          )}
        </g>
      ))}

      {/* Dynamic Actors */}
      {actors.map((actor) => {
        if (actor.type === "ego") {
          return (
            <g key={actor.id} transform={`translate(${actor.x}, ${actor.y})`}>
              <rect x="-18" y="-32" width="36" height="64" rx="8" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
              <rect x="-12" y="-12" width="24" height="20" rx="4" fill="#93c5fd" />
              <polygon points="-14,-32 14,-32 10,-42 -10,-42" fill="rgba(37, 99, 235, 0.4)" />
              <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
              <text x="0" y="44" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="800" letterSpacing="0.8">
                EGO ({data.speed} km/h)
              </text>
            </g>
          );
        }

        if (actor.type === "vehicle" || actor.type === "cutin") {
          const isCutIn = actor.type === "cutin";
          return (
            <g key={actor.id} transform={`translate(${actor.x}, ${actor.y})`}>
              {isCutIn && (
                <path d="M 0 0 C 20 -20, 40 -50, 60 -80" fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3 3" />
              )}
              <rect x="-16" y="-28" width="32" height="56" rx="6" fill="#3b465a" stroke={isCutIn ? "#f97316" : "#64748b"} strokeWidth={isCutIn ? "2" : "1"} />
              <rect x="-10" y="-8" width="20" height="12" rx="2" fill="#8292ac" />
              <text x="0" y="38" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">
                {actor.label}
              </text>
            </g>
          );
        }

        if (actor.type === "pedestrian") {
          return (
            <g key={actor.id} transform={`translate(${actor.x}, ${actor.y})`}>
              <line x1="0" y1="0" x2="-30" y2="0" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx="0" cy="0" r="7" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
              <text x="0" y="20" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">
                {actor.label}
              </text>
            </g>
          );
        }

        if (actor.type === "bike") {
          return (
            <g key={actor.id} transform={`translate(${actor.x}, ${actor.y})`}>
              <line x1="0" y1="0" x2="-10" y2="-40" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x="-5" y="-14" width="10" height="28" rx="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
              <text x="0" y="24" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">
                {actor.label}
              </text>
            </g>
          );
        }

        if (actor.type === "obstacle") {
          return (
            <g key={actor.id} transform={`translate(${actor.x}, ${actor.y})`}>
              <polygon points="0,-12 12,10 -12,10" fill="#ea580c" stroke="#ffffff" strokeWidth="2" />
              <text x="0" y="22" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">
                {actor.label}
              </text>
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
}

const navTabs = [
  { id: "VEHICLE", label: "VEHICLE", icon: Car },
  { id: "DRIVE", label: "DRIVE", icon: Compass },
  { id: "PLANNING", label: "PLANNING", icon: GitBranch },
  { id: "ANALYTICS", label: "ANALYTICS", icon: BarChart3 },
  { id: "SCENARIOS", label: "SCENARIOS", icon: Layers },
  { id: "SYSTEM", label: "SYSTEM", icon: Settings2 },
];

/* =========================================================
   MAIN APPLICATION (SINGLE-PAGE VIEWPORT SNAP SCROLL)
========================================================= */

function App() {
  const [selectedScenario, setSelectedScenario] = useState("Normal Driving");
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("VEHICLE");
  const [driveViewMode, setDriveViewMode] = useState("BEV"); // "BEV" | "CAMERA" | "SPLIT"
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState("C");
  const [scenarioFilter, setScenarioFilter] = useState("ALL");
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [timelineSeconds, setTimelineSeconds] = useState(8);
  const [videoError, setVideoError] = useState(false);

  const scrollContainerRef = useRef(null);

  const data = scenarioData[selectedScenario];
  const birdData = birdViewData[selectedScenario];
  const obstacles = obstacleData[selectedScenario];
  const comparison = comparisonData[selectedScenario];

  useEffect(() => {
    let timer = null;
    if (timelinePlaying) {
      timer = setInterval(() => {
        setTimelineSeconds((prev) => (prev >= 20 ? 0 : prev + 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timelinePlaying]);

  // Scroll to section with fluid automotive smooth animation
  const scrollToSection = (sectionId) => {
    const el = document.getElementById(`section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveTab(sectionId);
    }
  };

  // Continuous Scroll-Driven Automotive Transition Controller (0 latency, 60-120 FPS via RAF)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId = null;

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const vh = container.clientHeight || window.innerHeight;
        const scrollTop = container.scrollTop;

        // Normalized scroll progress for Screen 01 (0 = fully visible, 1 = fully transitioned out)
        const progress = Math.min(Math.max(scrollTop / vh, 0), 1);

        const heroEl = document.getElementById("section-VEHICLE");
        if (heroEl) {
          heroEl.style.setProperty("--hero-progress", progress.toFixed(4));
          heroEl.style.setProperty("--hero-scale", (1 - progress * 0.12).toFixed(4));
          heroEl.style.setProperty("--hero-opacity", (1 - progress * 0.35).toFixed(4));
          heroEl.style.setProperty("--hero-translate-y", `${(-progress * 48).toFixed(2)}px`);
          heroEl.style.setProperty("--rings-scale", (1 + progress * 0.16).toFixed(4));
          heroEl.style.setProperty("--rings-opacity", (1 - progress * 0.55).toFixed(4));
          heroEl.style.setProperty("--telemetry-left-x", `${(-progress * 40).toFixed(2)}px`);
          heroEl.style.setProperty("--telemetry-right-x", `${(progress * 40).toFixed(2)}px`);
          heroEl.style.setProperty("--telemetry-opacity", Math.max(0, 1 - progress * 1.6).toFixed(4));
          heroEl.style.setProperty("--status-strip-y", `${(-progress * 24).toFixed(2)}px`);
          heroEl.style.setProperty("--status-strip-opacity", Math.max(0, 1 - progress * 1.5).toFixed(4));
        }
      });
    };

    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const currentIndex = navTabs.findIndex((t) => t.id === activeTab);
      if (currentIndex === -1) return;

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        if (currentIndex < navTabs.length - 1) {
          e.preventDefault();
          scrollToSection(navTabs[currentIndex + 1].id);
        }
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        if (currentIndex > 0) {
          e.preventDefault();
          scrollToSection(navTabs[currentIndex - 1].id);
        }
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    // Initial run
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [activeTab]);

  // Observe active section on scroll to update navigation tabs dynamically
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            const id = entry.target.id.replace("section-", "");
            setActiveTab(id);
          }
        });
      },
      {
        root: container,
        threshold: [0.35, 0.7],
      }
    );

    navTabs.forEach((tab) => {
      const el = document.getElementById(`section-${tab.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Candidate trajectories
  const candidateTrajectories = useMemo(() => [
    { id: "A", name: "Trajectory A", title: "Nominal Center", risk: 32, clearance: "2.7 m", comfort: 80, efficiency: 91, note: "Encroaches clearance envelope" },
    { id: "B", name: "Trajectory B", title: "Aggressive Left", risk: 10, clearance: "3.2 m", comfort: 84, efficiency: 84, note: "Excess lateral jerk during transient" },
    { id: "C", name: "Trajectory C", title: "Adaptive Offset (Selected)", risk: 18, clearance: data.clearance, comfort: 94, efficiency: 88, note: "Zero collision risk, smooth curvature" },
    { id: "D", name: "Trajectory D", title: "Conservative Stop", risk: 12, clearance: "4.6 m", comfort: 76, efficiency: 65, note: "Excessive deceleration loss" },
  ], [data]);

  const filteredScenarios = useMemo(() => {
    const list = Object.keys(scenarioData);
    if (scenarioFilter === "ALL") return list;
    return list.filter((s) => scenarioData[s].category === scenarioFilter);
  }, [scenarioFilter]);

  // Segment blocks helper
  const renderSegmentedBar = (val, max, riskType = "low") => {
    const total = 14;
    const activeCount = Math.round((val / max) * total);
    return (
      <div className="segmented-meter">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`seg-block ${i < activeCount ? `active-${riskType}` : ""}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={`dashboard ${darkMode ? "dark-mode" : "light-mode"}`}>
      {/* =========================================================
          PERSISTENT FIXED AUTOMOTIVE STATUS BAR (HORIZON SUPERDRIVE)
      ========================================================= */}
      <header className="cockpit-header">
        <div className="cockpit-brand">
          <div className="cockpit-brand-icon">
            <Navigation size={18} strokeWidth={2.4} />
          </div>
          <div className="cockpit-brand-titles">
            <span className="brand-main">
              <span className="brand-primary">Horizon Carla</span>
              <span className="brand-accent-calligraphic">SuperDrive</span>
            </span>
            <span className="brand-sub">INTELLIGENT VEHICLE COCKPIT HMI</span>
          </div>
        </div>



        {/* Right Status & HUD Controls */}
        <div className="cockpit-header-right">
          <div className="cockpit-sim-status" title="Synchronous CARLA Simulation Loop">
            <span className="sim-pulse-indicator"></span>
            <span className="sim-status-text">SIMULATION MODE</span>
            <span className="sim-status-frame mono">Town05 • F1482</span>
          </div>

          <div
            className="cockpit-scenario-pill"
            onClick={() => scrollToSection("SCENARIOS")}
            title="Click to select scenario"
          >
            <span className="scenario-pill-tag">ODD</span>
            <span className="scenario-pill-val">{selectedScenario}</span>
          </div>

          <div className="cockpit-weather-chip">
            <CloudRain size={14} />
            <span>24.5°C</span>
          </div>

          <div className="cockpit-clock mono">
            10:50
          </div>

          <button
            className="cockpit-theme-btn"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* =========================================================
          FLOATING SIDE SCROLL INDICATOR DOTS
      ========================================================= */}
      <aside className="side-scroll-indicators" aria-label="Cockpit Screen Navigation">
        {navTabs.map((tab, idx) => (
          <button
            key={tab.id}
            className={`scroll-dot-item ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => scrollToSection(tab.id)}
            aria-label={`Scroll to Screen 0${idx + 1}: ${tab.label}`}
          >
            <span className="scroll-dot-tooltip mono">0{idx + 1} {tab.label}</span>
          </button>
        ))}
      </aside>

      {/* =========================================================
          SINGLE PAGE FULL-VIEWPORT SNAP SCROLL CONTAINER
      ========================================================= */}
      <div className="cockpit-scroll-container" ref={scrollContainerRef}>
        {/* -------------------------------------------------------
            SCREEN 01 — VEHICLE (EGO VEHICLE HOME SCREEN)
        ------------------------------------------------------- */}
        <section id="section-VEHICLE" className={`cockpit-screen-section ${activeTab === "VEHICLE" ? "is-active" : ""}`}>
          {/* Full-Screen Vehicle Video Backdrop (Covers Whole Screen) */}
          <div className="vehicle-screen-video-bg">
            {!videoError && (
              <video
                src="/make_such_video.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="vehicle-fullscreen-video"
                onError={() => setVideoError(true)}
              />
            )}
            <div className="vehicle-video-vignette"></div>
          </div>

          <div className="cockpit-vehicle-screen">
            {/* Subtle Automotive Identity Zone (Between Header & Pale Blue Hero Environment) */}
            <div className="cockpit-identity-zone">
              <div className="identity-titles-stack">
                <div className="secondary-identity">
                  <span className="secondary-text">Intelligent AV</span>
                  <span className="secondary-script">Platform</span>
                </div>
                <div className="tertiary-tech-tag">
                  <span className="tech-bullet">•</span>
                  <span>Adaptive Autonomous Research Cockpit</span>
                  <span className="tech-sep">/</span>
                  <span className="mono">CARLA Town05</span>
                </div>
              </div>

              <div className="hud-pill-box">
                <Sparkles size={13} />
                <span>{data.mode} CRUISE</span>
              </div>
            </div>

            {/* Central Vehicle Stage with Floating HUD Instrumentation */}
            <div className="vehicle-center-stage">
              {/* Left Floating HUD Cluster */}
              <div className="vehicle-hud-col vehicle-hud-col-left">
                <div className="hud-cluster">
                  <span className="hud-label">EGO VELOCITY</span>
                  <div className="hud-hero-metric">
                    <span className="huge-num">{data.speed}</span>
                    <span className="unit">km/h</span>
                  </div>
                  {renderSegmentedBar(data.speed, 100, "low")}
                </div>

                <div className="hud-cluster">
                  <span className="hud-label">ACCELERATION</span>
                  <div className="hud-hero-metric">
                    <span className="huge-num mono" style={{ fontSize: "38px" }}>{data.acceleration}</span>
                  </div>
                </div>

                <div className="hud-cluster">
                  <span className="hud-label">STEERING ANGLE</span>
                  <div className="hud-hero-metric">
                    <span className="huge-num mono" style={{ fontSize: "38px" }}>{data.steering}</span>
                  </div>
                </div>
              </div>

              {/* Center Vehicle Dominant Stage with Actual Downloaded Car */}
              <div className="vehicle-stage-core">
                <div className="stage-studio-floor"></div>
                <div className="stage-reflection-disc"></div>
                <div className="stage-radial-glow"></div>
                <div className="stage-orbit-ring ring-outer"></div>
                <div className="stage-orbit-ring ring-mid"></div>
                <div className="stage-orbit-ring ring-inner"></div>

                {/* Front Wheel Telemetry */}
                <div className="tire-telemetry-cluster tire-front-wheel">
                  <span className="tire-label">FRONT AXLE</span>
                  <span className="tire-val mono">2.4 Bar • 32°C</span>
                  <div className="tire-seg-bar">
                    <span className="seg-pip active"></span>
                    <span className="seg-pip active"></span>
                    <span className="seg-pip active"></span>
                    <span className="seg-pip"></span>
                  </div>
                </div>

                {/* Rear Wheel Telemetry */}
                <div className="tire-telemetry-cluster tire-rear-wheel">
                  <span className="tire-label">REAR AXLE</span>
                  <span className="tire-val mono">2.5 Bar • 33°C</span>
                  <div className="tire-seg-bar">
                    <span className="seg-pip active"></span>
                    <span className="seg-pip active"></span>
                    <span className="seg-pip active"></span>
                    <span className="seg-pip"></span>
                  </div>
                </div>

                {/* Fallback car image only if full-screen video cannot load */}
                {videoError && (
                  <div className="vehicle-image-wrapper">
                    <img
                      src="/download-removebg-preview.png"
                      alt="Autonomous Ego Vehicle"
                      className="vehicle-real-photo"
                    />
                    <div className="vehicle-ground-shadow"></div>
                  </div>
                )}

                <div className="vehicle-platform-plate mono">
                  <span>INTELLIGENT AV PLATFORM • 60 FPS SYNCHRONOUS</span>
                </div>
              </div>

              {/* Right Floating HUD Cluster */}
              <div className="vehicle-hud-col vehicle-hud-col-right">
                <div className="hud-cluster">
                  <span className="hud-label">TIME TO COLLISION</span>
                  <div className="hud-hero-metric">
                    <span className="huge-num text-accent mono">{data.ttc}</span>
                  </div>
                </div>

                <div className="hud-cluster">
                  <span className="hud-label">MIN CLEARANCE</span>
                  <div className="hud-hero-metric">
                    <span className="huge-num mono" style={{ fontSize: "40px" }}>{data.clearance}</span>
                  </div>
                </div>

                <div className="hud-cluster">
                  <span className="hud-label">COMPOSITE RISK INDEX</span>
                  <div className={`hud-risk-box ${getRiskClass(data.risk)}`}>
                    <span>{data.risk} ({data.riskScore} / 100)</span>
                  </div>
                  {renderSegmentedBar(data.riskScore, 100, data.risk.toLowerCase())}
                </div>
              </div>
            </div>

            {/* Bottom Floating Horizontal Status Strip */}
            <div className="glass-panel vehicle-bottom-strip">
              <div className="strip-sensor-group">
                <div className="strip-sensor-pill">
                  <span className="sensor-dot"></span>
                  <span className="sensor-name">CARLA</span>
                  <span className="sensor-state">SIMULATION MODE</span>
                </div>
                <div className="strip-sensor-pill">
                  <span className="sensor-dot"></span>
                  <span className="sensor-name">CAMERA</span>
                  <span className="sensor-state">READY</span>
                </div>
                <div className="strip-sensor-pill">
                  <span className="sensor-dot"></span>
                  <span className="sensor-name">LiDAR</span>
                  <span className="sensor-state">ONLINE</span>
                </div>
                <div className="strip-sensor-pill">
                  <span className="sensor-dot"></span>
                  <span className="sensor-name">RADAR</span>
                  <span className="sensor-state">ONLINE</span>
                </div>
                <div className="strip-sensor-pill">
                  <span className="sensor-dot"></span>
                  <span className="sensor-name">PLANNER</span>
                  <span className="sensor-state" style={{ color: "var(--accent)" }}>ADAPTIVE ({data.latency})</span>
                </div>
              </div>

              <button
                className="cockpit-primary-cta"
                onClick={() => scrollToSection("DRIVE")}
              >
                <span>Engage Autonomous Drive</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------
            SCREEN 02 — DRIVE (AUTONOMOUS DRIVING COCKPIT - REF 1)
        ------------------------------------------------------- */}
        <section id="section-DRIVE" className={`cockpit-screen-section ${activeTab === "DRIVE" ? "is-active" : ""}`}>
          <div className="cockpit-drive-screen">
            {/* Dominant Driving Simulation (Occupies 75% of screen) */}
            <div className="drive-main-visual">
              {/* Floating View Switcher (Top Center) */}
              <div className="drive-floating-toolbar">
                <button
                  className={`toolbar-mode-btn ${driveViewMode === "BEV" ? "active" : ""}`}
                  onClick={() => setDriveViewMode("BEV")}
                >
                  <Eye size={13} />
                  <span>BIRD'S-EYE</span>
                </button>
                <button
                  className={`toolbar-mode-btn ${driveViewMode === "CAMERA" ? "active" : ""}`}
                  onClick={() => setDriveViewMode("CAMERA")}
                >
                  <Camera size={13} />
                  <span>CAMERA</span>
                </button>
                <button
                  className={`toolbar-mode-btn ${driveViewMode === "SPLIT" ? "active" : ""}`}
                  onClick={() => setDriveViewMode("SPLIT")}
                >
                  <Navigation size={13} />
                  <span>SPLIT VIEW</span>
                </button>
              </div>

              {/* Floating Top-Left Navigation Guidance HUD (Reference 1 style!) */}
              <div className="drive-nav-hud-box">
                <div className="nav-hud-top">
                  <div className="nav-arrow-icon">
                    <Navigation size={15} />
                  </div>
                  <div>
                    <span className="nav-dist-num mono">280</span>
                    <span style={{ fontSize: "12px", fontWeight: "700" }}> m</span>
                  </div>
                </div>
                <span className="nav-road-title">Luoshan Elevated Corridor</span>
                <div className="nav-hud-meta mono">
                  <span>20 km</span>
                  <span>•</span>
                  <span>40 min</span>
                  <span>•</span>
                  <span>11:30 arr</span>
                </div>
              </div>

              {/* Floating Bottom-Left Velocity & TTC Gauges */}
              <div className="drive-floating-instruments">
                <div className="floating-gauge-pill">
                  <span className="gauge-tag">VELOCITY</span>
                  <div className="gauge-val-row">
                    <span className="val">{data.speed}</span>
                    <span className="unit">km/h</span>
                  </div>
                </div>
                <div className="floating-gauge-pill">
                  <span className="gauge-tag">TIME TO COLLISION</span>
                  <div className="gauge-val-row">
                    <span className="val mono text-accent">{data.ttc}</span>
                  </div>
                </div>
              </div>

              {/* Main Visual Renderers based on Mode */}
              {driveViewMode === "BEV" && (
                <SpatialDriveView
                  scenario={selectedScenario}
                  data={data}
                  birdData={birdData}
                  obstacles={obstacles}
                />
              )}

              {driveViewMode === "CAMERA" && (
                <div className="camera-perspective-view">
                  <div className="camera-sky"></div>
                  <div className="camera-ground"></div>
                  <svg className="camera-grid-svg" viewBox="0 0 800 450" preserveAspectRatio="none">
                    <line x1="0" y1="200" x2="800" y2="200" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" />
                    <polygon points="360,200 440,200 780,450 20,450" fill="#1e293b" />
                    <line x1="360" y1="200" x2="20" y2="450" stroke="#475569" strokeWidth="3" />
                    <line x1="440" y1="200" x2="780" y2="450" stroke="#475569" strokeWidth="3" />
                    <line x1="400" y1="200" x2="400" y2="450" stroke="#cbd5e1" strokeWidth="3" strokeDasharray="20 18" />
                    <line x1="380" y1="200" x2="210" y2="450" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="10 12" />
                    <line x1="420" y1="200" x2="590" y2="450" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="10 12" />
                    <path d="M 280 450 Q 400 410 520 450 Z" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                    <path d="M 400 410 Q 410 320 405 210" fill="none" stroke="#06b6d4" strokeWidth="5" strokeLinecap="round" />
                  </svg>

                  {birdData.vehicle && (
                    <div className="camera-hud-target" style={{ top: "42%", left: "47%" }}>
                      <span>LEAD VEHICLE</span>
                      <span className="mono" style={{ fontSize: "8px", color: "#38bdf8" }}>18.4m • 38 km/h</span>
                    </div>
                  )}
                  {birdData.cutIn && (
                    <div className="camera-hud-target" style={{ top: "46%", left: "34%", borderColor: "#f97316" }}>
                      <span>CUT-IN ACTOR</span>
                      <span className="mono" style={{ fontSize: "8px", color: "#f97316" }}>4.8m • 32 km/h</span>
                    </div>
                  )}
                </div>
              )}

              {driveViewMode === "SPLIT" && (
                <div className="drive-split-container">
                  <div className="split-view-col">
                    <div className="camera-perspective-view">
                      <div className="camera-sky"></div>
                      <div className="camera-ground"></div>
                      <svg className="camera-grid-svg" viewBox="0 0 400 350" preserveAspectRatio="none">
                        <polygon points="170,140 230,140 390,350 10,350" fill="#1e293b" />
                        <line x1="200" y1="140" x2="200" y2="350" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="12 12" />
                        <path d="M 140 350 Q 200 320 260 350 Z" fill="#2563eb" />
                        <path d="M 200 320 Q 210 240 205 150" fill="none" stroke="#06b6d4" strokeWidth="4" />
                      </svg>
                    </div>
                  </div>
                  <div className="split-view-col">
                    <SpatialDriveView
                      scenario={selectedScenario}
                      data={data}
                      birdData={birdData}
                      obstacles={obstacles}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right Telemetry Sidebar (Translucent Glass Instrumentation) */}
            <div className="glass-panel drive-hud-sidebar">
              <div className="sidebar-title-row">
                <span className="sidebar-heading">TELEMETRY INSTRUMENTATION</span>
                <span className={`hud-risk-box ${getRiskClass(data.risk)}`} style={{ padding: "3px 10px", fontSize: "10px" }}>
                  {data.risk}
                </span>
              </div>

              {/* Acceleration Balance */}
              <div className="instrument-row">
                <div className="instrument-label-row">
                  <span>LONGITUDINAL ACCEL</span>
                  <span className="mono">{data.acceleration}</span>
                </div>
                <div className="instrument-bar-rail">
                  <div className="instrument-bar-fill" style={{ width: "65%" }}></div>
                </div>
              </div>

              {/* Steering Angle */}
              <div className="instrument-row">
                <div className="instrument-label-row">
                  <span>LATERAL STEERING</span>
                  <span className="mono">{data.steering}</span>
                </div>
                <div className="instrument-bar-rail">
                  <div className="instrument-bar-fill" style={{ width: "45%" }}></div>
                </div>
              </div>

              {/* Throttle / Brake Dual Gauges */}
              <div className="instrument-row">
                <div className="instrument-label-row">
                  <span>THROTTLE: {data.throttle}</span>
                  <span>BRAKE: {data.brake}</span>
                </div>
                <div className="instrument-bar-rail">
                  <div className="instrument-bar-fill" style={{ width: data.brake !== "0%" ? data.brake : data.throttle, background: data.brake !== "0%" ? "#ef4444" : "var(--accent)" }}></div>
                </div>
              </div>

              {/* Min Clearance */}
              <div className="instrument-row">
                <div className="instrument-label-row">
                  <span>MIN CLEARANCE ENVELOPE</span>
                  <span className="mono">{data.clearance}</span>
                </div>
                {renderSegmentedBar(parseFloat(data.clearance) * 20, 100, "low")}
              </div>

              {/* Composite Risk Index */}
              <div className="instrument-row">
                <div className="instrument-label-row">
                  <span>COMPOSITE RISK INDEX</span>
                  <span className="mono">{data.riskScore} / 100</span>
                </div>
                {renderSegmentedBar(data.riskScore, 100, data.risk.toLowerCase())}
              </div>

              {/* Tracked Obstacles */}
              <div style={{ marginTop: "8px", borderTop: "1px solid var(--surface-border-subtle)", paddingTop: "10px" }}>
                <span className="hud-label" style={{ marginBottom: "6px", display: "block" }}>TRACKED OBSTACLES</span>
                {obstacles && obstacles.map((obs, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "var(--surface-glass-subtle)", borderRadius: "8px", marginBottom: "4px", fontSize: "11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="sensor-dot" style={{ background: obs.risk === "CRITICAL" ? "#ef4444" : obs.risk === "HIGH" ? "#f97316" : "var(--accent)" }}></span>
                      <strong>{obs.name}</strong>
                    </div>
                    <span className="mono">{obs.distance} • {obs.speed}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------
            SCREEN 03 — PLANNING (TRAJECTORY MAP & EXPLAINABILITY)
        ------------------------------------------------------- */}
        <section id="section-PLANNING" className={`cockpit-screen-section ${activeTab === "PLANNING" ? "is-active" : ""}`}>
          <div className="cockpit-planning-screen">
            {/* Main Visual: 70% Trajectory Map */}
            <div className="planning-main-map">
              <svg className="spatial-bev-svg" viewBox="0 0 600 500" preserveAspectRatio="xMidYMid meet">
                {/* Roadway */}
                <rect x="140" y="0" width="320" height="500" fill="#18202d" rx="6" />
                <line x1="140" y1="0" x2="140" y2="500" stroke="#475569" strokeWidth="2" />
                <line x1="460" y1="0" x2="460" y2="500" stroke="#475569" strokeWidth="2" />
                <line x1="300" y1="0" x2="300" y2="500" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="14 12" />

                {/* Candidate A (Nominal Center - Gray dashed) */}
                <path d="M 300 430 Q 300 250 300 80" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 6" />
                {/* Candidate B (Aggressive Left - Purple) */}
                <path d="M 300 430 Q 280 250 210 80" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="6 6" />
                {/* Candidate D (Conservative Stop - Orange) */}
                <path d="M 300 430 Q 320 300 370 120" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="6 6" />
                {/* Candidate C (Selected Adaptive Path - Cyan Glowing) */}
                <path d="M 300 430 Q 315 270 335 80" fill="none" stroke="#06b6d4" strokeWidth="5" strokeLinecap="round" />

                {/* Waypoints along Trajectory C */}
                {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0].map((t, idx) => {
                  const y = 430 - t * 350;
                  const x = 300 + t * 35;
                  return (
                    <circle key={idx} cx={x} cy={y} r={4} fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
                  );
                })}

                {/* Ego Vehicle Node */}
                <circle cx="300" cy="430" r="12" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
                <text x="300" y="434" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">AI</text>
              </svg>

              {/* Interactive Candidate Pills Floating directly over the map */}
              <div
                className={`map-candidate-pill ${selectedTrajectoryId === "A" ? "selected" : ""}`}
                style={{ top: "70px", left: "42%" }}
                onClick={() => setSelectedTrajectoryId("A")}
              >
                <div className="candidate-letter-badge" style={{ background: "#64748b" }}>A</div>
                <div className="candidate-info-text">
                  <span className="candidate-title">Path A (Nominal)</span>
                  <span className="candidate-metrics mono">Risk 32 • Clear 2.7m</span>
                </div>
              </div>

              <div
                className={`map-candidate-pill ${selectedTrajectoryId === "B" ? "selected" : ""}`}
                style={{ top: "70px", left: "22%" }}
                onClick={() => setSelectedTrajectoryId("B")}
              >
                <div className="candidate-letter-badge" style={{ background: "#a855f7" }}>B</div>
                <div className="candidate-info-text">
                  <span className="candidate-title">Path B (Aggressive Left)</span>
                  <span className="candidate-metrics mono">Risk 10 • Clear 3.2m</span>
                </div>
              </div>

              <div
                className={`map-candidate-pill ${selectedTrajectoryId === "C" ? "selected" : ""}`}
                style={{ top: "70px", right: "24%" }}
                onClick={() => setSelectedTrajectoryId("C")}
              >
                <div className="candidate-letter-badge" style={{ background: "#06b6d4" }}>C</div>
                <div className="candidate-info-text">
                  <span className="candidate-title" style={{ color: "#38bdf8" }}>Path C (Selected Adaptive)</span>
                  <span className="candidate-metrics mono">Risk 18 • Clear 3.8m</span>
                </div>
              </div>

              <div
                className={`map-candidate-pill ${selectedTrajectoryId === "D" ? "selected" : ""}`}
                style={{ top: "110px", right: "12%" }}
                onClick={() => setSelectedTrajectoryId("D")}
              >
                <div className="candidate-letter-badge" style={{ background: "#f97316" }}>D</div>
                <div className="candidate-info-text">
                  <span className="candidate-title">Path D (Conservative)</span>
                  <span className="candidate-metrics mono">Risk 12 • Clear 4.6m</span>
                </div>
              </div>
            </div>

            {/* Right Compact Intelligent Decision Panel (User Specified) */}
            <div className="glass-panel planning-decision-sidebar">
              <div className="sidebar-title-row">
                <span className="sidebar-heading">INTELLIGENT DECISION PANEL</span>
                <span className="mono" style={{ fontSize: "11px", color: "var(--accent)" }}>CYCLE {data.latency}</span>
              </div>

              {/* Decision Action Banner */}
              <div className="decision-hero-banner">
                <span className="decision-hero-title">ADAPTIVE DECISION</span>
                <span className="decision-hero-action">{data.decision}</span>
              </div>

              {/* Rationale in Short Phrases (No Long Paragraphs!) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span className="hud-label">SELECTION RATIONALE</span>
                <div className="reason-chip-list">
                  <div className="reason-tag">
                    <CheckCircle2 size={13} color="var(--risk-low)" />
                    <span>LOWER COLLISION RISK (18/100 vs 32)</span>
                  </div>
                  <div className="reason-tag">
                    <CheckCircle2 size={13} color="var(--risk-low)" />
                    <span>HIGHER LATERAL CLEARANCE ({data.clearance})</span>
                  </div>
                  <div className="reason-tag">
                    <CheckCircle2 size={13} color="var(--risk-low)" />
                    <span>SMOOTH CURVATURE ({data.smoothness} INDEX)</span>
                  </div>
                  <div className="reason-tag">
                    <CheckCircle2 size={13} color="var(--risk-low)" />
                    <span>MINIMAL LONGITUDINAL ACCEL JERK</span>
                  </div>
                </div>
              </div>

              {/* Candidate Trajectory Evaluator List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                <span className="hud-label">EVALUATED TRAJECTORIES</span>
                <div className="candidate-deck">
                  {candidateTrajectories.map((c) => (
                    <div
                      key={c.id}
                      className={`candidate-row-card ${selectedTrajectoryId === c.id ? "active" : ""}`}
                      onClick={() => setSelectedTrajectoryId(c.id)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="candidate-letter-badge" style={{ background: c.id === "C" ? "#06b6d4" : "var(--text-secondary)" }}>
                          {c.id}
                        </span>
                        <div>
                          <strong style={{ fontSize: "11px" }}>{c.title}</strong>
                          <div className="mono" style={{ fontSize: "9px", color: "var(--text-muted)" }}>{c.note}</div>
                        </div>
                      </div>
                      <div className="mono" style={{ textAlign: "right", fontSize: "11px" }}>
                        <span style={{ color: c.risk < 20 ? "var(--risk-low)" : "var(--risk-high)" }}>R:{c.risk}</span>
                        <span style={{ marginLeft: "6px" }}>{c.clearance}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------
            SCREEN 04 — ANALYTICS (MOTORSPORT TELEMETRY - REF 3)
        ------------------------------------------------------- */}
        <section id="section-ANALYTICS" className={`cockpit-screen-section ${activeTab === "ANALYTICS" ? "is-active" : ""}`}>
          <div className="cockpit-analytics-screen">
            {/* Top Row: 4 Motorsport Metrics with Segmented Bars (Reference 3) */}
            <div className="motorsport-top-metrics">
              <div className="glass-panel motorsport-metric-panel">
                <div className="motorsport-metric-header">
                  <span className="hud-label">COMPOSITE RISK INDEX</span>
                  <Shield size={14} color={data.risk === "LOW" ? "var(--risk-low)" : "var(--risk-high)"} />
                </div>
                <div className="motorsport-metric-num">{data.riskScore}%</div>
                {renderSegmentedBar(data.riskScore, 100, data.risk.toLowerCase())}
              </div>

              <div className="glass-panel motorsport-metric-panel">
                <div className="motorsport-metric-header">
                  <span className="hud-label">PLANNER LATENCY</span>
                  <Zap size={14} color="var(--accent)" />
                </div>
                <div className="motorsport-metric-num">{data.latency}</div>
                {renderSegmentedBar(parseFloat(data.latency), 120, "low")}
              </div>

              <div className="glass-panel motorsport-metric-panel">
                <div className="motorsport-metric-header">
                  <span className="hud-label">MIN CLEARANCE ENVELOPE</span>
                  <Compass size={14} color="var(--accent-cyan)" />
                </div>
                <div className="motorsport-metric-num">{data.clearance}</div>
                {renderSegmentedBar(parseFloat(data.clearance) * 20, 100, "low")}
              </div>

              <div className="glass-panel motorsport-metric-panel">
                <div className="motorsport-metric-header">
                  <span className="hud-label">TRAJECTORY SMOOTHNESS</span>
                  <Sparkles size={14} color="var(--risk-low)" />
                </div>
                <div className="motorsport-metric-num">{data.smoothness}</div>
                {renderSegmentedBar(parseFloat(data.smoothness) * 100, 100, "low")}
              </div>
            </div>

            {/* Middle Row: Motorsport Line Spline + Instrumentation (Ref 3) */}
            <div className="analytics-middle-row">
              {/* Left: Telemetry Multi-Curve Spline */}
              <div className="glass-panel telemetry-spline-panel">
                <div className="sidebar-title-row">
                  <span className="sidebar-heading">SPEED & CLEARANCE PROFILE (WAYPOINTS T1–T10)</span>
                  <div style={{ display: "flex", gap: "12px", fontSize: "10px", fontWeight: "700" }}>
                    <span style={{ color: "#06b6d4" }}>● Speed (km/h)</span>
                    <span style={{ color: "#10b981" }}>● Clearance (m × 10)</span>
                    <span style={{ color: "#f97316" }}>● Risk (%)</span>
                  </div>
                </div>

                <svg viewBox="0 0 600 170" style={{ width: "100%", height: "100%", marginTop: "8px" }}>
                  <defs>
                    <linearGradient id="speedCurveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <line x1="40" y1="30" x2="580" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <line x1="40" y1="80" x2="580" y2="80" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <line x1="40" y1="130" x2="580" y2="130" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />

                  {/* Speed Spline Curve */}
                  <path d="M 50 70 C 150 75, 250 85, 350 80 C 450 75, 520 70, 570 65" fill="none" stroke="#06b6d4" strokeWidth="3.5" />
                  <path d="M 50 70 C 150 75, 250 85, 350 80 C 450 75, 520 70, 570 65 L 570 145 L 50 145 Z" fill="url(#speedCurveGrad)" />

                  {/* Clearance Spline Curve */}
                  <path d="M 50 110 C 150 115, 250 118, 350 114 C 450 110, 520 108, 570 105" fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="4 3" />

                  {/* Waypoint Axis Labels */}
                  {["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"].map((w, idx) => (
                    <text key={idx} x={50 + idx * 52} y="158" fill="var(--text-muted)" fontSize="9" textAnchor="middle" className="mono">
                      {w}
                    </text>
                  ))}
                </svg>
              </div>

              {/* Right: Motorsport Instruments (Radial & 4-Wheel Brake/Tire) */}
              <div className="glass-panel motorsport-instruments-panel">
                <div className="sidebar-title-row">
                  <span className="sidebar-heading">CHASSIS & CORNERING TELEMETRY</span>
                  <span className="mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>SYNCHRONOUS</span>
                </div>

                <div className="instruments-quad-grid">
                  {/* Radial Cycle Gauge */}
                  <div className="quad-instrument-card">
                    <span className="hud-label">PLANNER CYCLE</span>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "4px 0" }}>
                      <svg width="60" height="60" viewBox="0 0 60 60">
                        <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="5" />
                        <circle cx="30" cy="30" r="24" fill="none" stroke="var(--accent)" strokeWidth="5" strokeDasharray="150" strokeDashoffset="40" strokeLinecap="round" />
                        <text x="30" y="34" textAnchor="middle" fontSize="11" fontWeight="900" fill="var(--text-primary)" className="mono">
                          24Hz
                        </text>
                      </svg>
                    </div>
                    <span className="mono" style={{ fontSize: "9px", textAlign: "center", color: "var(--text-muted)" }}>42 ms execution</span>
                  </div>

                  {/* 4-Wheel Brake Temp / Tire telemetry (Reference 3 FL/FR/RL/RR) */}
                  <div className="quad-instrument-card">
                    <span className="hud-label">4-CORNER BRAKE / TEMP</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px" }}>
                        <span className="mono">FL: 38°C</span>
                        <span className="mono text-accent">2.4 Bar</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px" }}>
                        <span className="mono">FR: 38°C</span>
                        <span className="mono text-accent">2.4 Bar</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px" }}>
                        <span className="mono">RL: 39°C</span>
                        <span className="mono text-accent">2.5 Bar</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px" }}>
                        <span className="mono">RR: 39°C</span>
                        <span className="mono text-accent">2.5 Bar</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Baseline vs. Adaptive Benchmark Telemetry */}
            <div className="glass-panel analytics-benchmark-panel">
              <div className="sidebar-title-row">
                <span className="sidebar-heading">BASELINE VS. ADAPTIVE BENCHMARK EVALUATION</span>
                <span className="delta-badge delta-positive">ZERO CRITICAL CONTACTS</span>
              </div>

              <div className="benchmark-row-grid">
                <div className="benchmark-stat-card">
                  <span className="hud-label">COLLISIONS</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: "14px", fontWeight: "800" }}>{comparison.collision.adaptive}</span>
                    <span className="delta-badge delta-positive">Base: {comparison.collision.baseline}</span>
                  </div>
                </div>

                <div className="benchmark-stat-card">
                  <span className="hud-label">MIN CLEARANCE</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: "14px", fontWeight: "800" }}>{comparison.minClearance.adaptive}</span>
                    <span className="delta-badge delta-positive">Base: {comparison.minClearance.baseline}</span>
                  </div>
                </div>

                <div className="benchmark-stat-card">
                  <span className="hud-label">REPLAN LATENCY</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: "14px", fontWeight: "800" }}>{comparison.latency.adaptive}</span>
                    <span className="delta-badge delta-positive">Base: {comparison.latency.baseline}</span>
                  </div>
                </div>

                <div className="benchmark-stat-card">
                  <span className="hud-label">PATH SMOOTHNESS</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: "14px", fontWeight: "800" }}>{comparison.smoothness.adaptive}</span>
                    <span className="delta-badge delta-positive">Base: {comparison.smoothness.baseline}</span>
                  </div>
                </div>

                <div className="benchmark-stat-card">
                  <span className="hud-label">ROUTE COMPLETION</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: "14px", fontWeight: "800" }}>{comparison.completion.adaptive}</span>
                    <span className="delta-badge delta-positive">Base: {comparison.completion.baseline}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------
            SCREEN 05 — SCENARIOS (DRIVE MODE SELECTION DECK)
        ------------------------------------------------------- */}
        <section id="section-SCENARIOS" className={`cockpit-screen-section ${activeTab === "SCENARIOS" ? "is-active" : ""}`}>
          <div className="cockpit-scenarios-screen">
            {/* Filter Category Pills */}
            <div className="scenario-filter-bar">
              <div className="filter-pills-group">
                {["ALL", "NORMAL", "INTERACTION", "SAFETY", "ENVIRONMENT"].map((f) => (
                  <button
                    key={f}
                    className={`filter-pill-btn ${scenarioFilter === f ? "active" : ""}`}
                    onClick={() => setScenarioFilter(f)}
                  >
                    {f === "ALL" ? "ALL PRESETS" : f}
                  </button>
                ))}
              </div>
              <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                ODD OPERATIONAL DESIGN DOMAIN: UNSTRUCTURED ROADWAYS
              </span>
            </div>

            {/* Immersive Driving Mode Scenario Tiles (Not Generic Cards!) */}
            <div className="scenarios-tiles-deck">
              {filteredScenarios.map((scenName) => {
                const item = scenarioData[scenName];
                const isActive = selectedScenario === scenName;
                return (
                  <div
                    key={scenName}
                    className={`scenario-mode-tile ${isActive ? "active-mode" : ""}`}
                    onClick={() => setSelectedScenario(scenName)}
                  >
                    <div className="tile-backdrop-art"></div>
                    <div className="tile-top-row">
                      <span className="tile-title">{scenName}</span>
                      <span className={`hud-risk-box ${getRiskClass(item.risk)}`} style={{ padding: "2px 8px", fontSize: "9px" }}>
                        {item.risk}
                      </span>
                    </div>

                    <div className="tile-metrics-row">
                      <span className="tile-speed-val mono">{item.speed}</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)" }}>km/h</span>
                      <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "auto" }}>
                        Clear {item.clearance}
                      </span>
                    </div>

                    <span className="tile-desc">{item.eventTitle}</span>

                    <button className="tile-engage-btn">
                      {isActive ? "ACTIVE MODE" : "SELECT MODE"}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Bottom Scenario Execution Scrubber Timeline */}
            <div className="glass-panel scenario-timeline-bar">
              <button
                className="timeline-ctrl-btn"
                onClick={() => setTimelinePlaying(!timelinePlaying)}
                title={timelinePlaying ? "Pause" : "Play"}
              >
                {timelinePlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                className="timeline-ctrl-btn"
                onClick={() => setTimelineSeconds(0)}
                title="Reset Timeline"
              >
                <RotateCcw size={14} />
              </button>

              <span className="mono" style={{ fontSize: "12px", fontWeight: "700" }}>
                00:{timelineSeconds.toString().padStart(2, "0")}.00
              </span>

              <div
                className="timeline-scrubber-rail"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setTimelineSeconds(Math.round(pct * 20));
                }}
              >
                <div
                  className="timeline-scrubber-fill"
                  style={{ width: `${(timelineSeconds / 20) * 100}%` }}
                ></div>
              </div>

              <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                00:20.00 (ODD SIM)
              </span>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------
            SCREEN 06 — SYSTEM (HARDWARE & PIPELINE CONSOLE)
        ------------------------------------------------------- */}
        <section id="section-SYSTEM" className={`cockpit-screen-section ${activeTab === "SYSTEM" ? "is-active" : ""}`}>
          <div className="cockpit-system-screen">
            {/* Top: Closed-Loop Architecture Ribbon Flow */}
            <div className="glass-panel pipeline-ribbon-panel">
              <div className="sidebar-title-row">
                <span className="sidebar-heading">CLOSED-LOOP AUTONOMOUS ARCHITECTURE</span>
                <span className="mono" style={{ fontSize: "11px", color: "var(--accent)" }}>SYNCHRONOUS EXECUTION</span>
              </div>

              <div className="pipeline-ribbon-flow">
                <div className="pipeline-node">
                  <span className="node-role-tag">SIMULATOR</span>
                  <span className="node-name">CARLA 0.9.15</span>
                  <span className="node-latency mono">Town05 Env</span>
                </div>
                <span className="pipeline-arrow">→</span>

                <div className="pipeline-node">
                  <span className="node-role-tag">PERCEPTION</span>
                  <span className="node-name">128-ch LiDAR</span>
                  <span className="node-latency mono">25.0 ms</span>
                </div>
                <span className="pipeline-arrow">→</span>

                <div className="pipeline-node">
                  <span className="node-role-tag">PREDICTION</span>
                  <span className="node-name">Motion Model</span>
                  <span className="node-latency mono">18.0 ms</span>
                </div>
                <span className="pipeline-arrow">→</span>

                <div className="pipeline-node">
                  <span className="node-role-tag">SAFETY</span>
                  <span className="node-name">Risk Engine</span>
                  <span className="node-latency mono">4.0 ms</span>
                </div>
                <span className="pipeline-arrow">→</span>

                <div className="pipeline-node active-node">
                  <span className="node-role-tag">PLANNER</span>
                  <span className="node-name" style={{ color: "var(--accent)" }}>Adaptive Spline</span>
                  <span className="node-latency mono">{data.latency}</span>
                </div>
                <span className="pipeline-arrow">→</span>

                <div className="pipeline-node">
                  <span className="node-role-tag">ACTUATION</span>
                  <span className="node-name">Control Bridge</span>
                  <span className="node-latency mono">3.0 ms</span>
                </div>
              </div>
            </div>

            {/* Bottom Split: Sensor Diagnostics & Technical Event Log */}
            <div className="system-split-row">
              {/* Sensor Diagnostics */}
              <div className="glass-panel sensor-diagnostics-panel">
                <div className="sidebar-title-row">
                  <span className="sidebar-heading">SENSOR TELEMETRY ARRAY</span>
                  <span className="mono" style={{ fontSize: "11px", color: "var(--risk-low)" }}>5 / 5 ONLINE</span>
                </div>

                <div className="sensor-cockpit-row">
                  <div className="sensor-row-left">
                    <div className="sensor-icon-well"><Camera size={16} /></div>
                    <div>
                      <strong style={{ fontSize: "11px" }}>Optical RGB Camera Array</strong>
                      <div className="mono" style={{ fontSize: "9px", color: "var(--text-muted)" }}>1920×1080 @ 60 FPS • 16.6 ms</div>
                    </div>
                  </div>
                  <span className="delta-badge delta-positive">ONLINE</span>
                </div>

                <div className="sensor-cockpit-row">
                  <div className="sensor-row-left">
                    <div className="sensor-icon-well"><Radio size={16} /></div>
                    <div>
                      <strong style={{ fontSize: "11px" }}>Solid-State LiDAR Array</strong>
                      <div className="mono" style={{ fontSize: "9px", color: "var(--text-muted)" }}>128 Channels • 1.2M pts/sec • 25.0 ms</div>
                    </div>
                  </div>
                  <span className="delta-badge delta-positive">ONLINE</span>
                </div>

                <div className="sensor-cockpit-row">
                  <div className="sensor-row-left">
                    <div className="sensor-icon-well"><Radio size={16} /></div>
                    <div>
                      <strong style={{ fontSize: "11px" }}>77 GHz RADAR Array</strong>
                      <div className="mono" style={{ fontSize: "9px", color: "var(--text-muted)" }}>Doppler Velocity Tracking • 18.2 ms</div>
                    </div>
                  </div>
                  <span className="delta-badge delta-positive">ONLINE</span>
                </div>

                <div className="sensor-cockpit-row">
                  <div className="sensor-row-left">
                    <div className="sensor-icon-well"><Navigation size={16} /></div>
                    <div>
                      <strong style={{ fontSize: "11px" }}>GNSS RTK Receiver</strong>
                      <div className="mono" style={{ fontSize: "9px", color: "var(--text-muted)" }}>Sub-decimeter localization • 10.0 ms</div>
                    </div>
                  </div>
                  <span className="delta-badge delta-positive">ONLINE</span>
                </div>

                <div className="sensor-cockpit-row">
                  <div className="sensor-row-left">
                    <div className="sensor-icon-well"><Activity size={16} /></div>
                    <div>
                      <strong style={{ fontSize: "11px" }}>6-DOF IMU Sensor</strong>
                      <div className="mono" style={{ fontSize: "9px", color: "var(--text-muted)" }}>Tri-axial gyro & accel @ 200 Hz • 5.0 ms</div>
                    </div>
                  </div>
                  <span className="delta-badge delta-positive">ONLINE</span>
                </div>
              </div>

              {/* Technical Event Log */}
              <div className="glass-panel event-log-panel">
                <div className="sidebar-title-row">
                  <span className="sidebar-heading">TECHNICAL EVENT LOG</span>
                  <span className="mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>REAL-TIME</span>
                </div>

                <div className="cockpit-log-item mono">
                  <span style={{ color: "var(--text-muted)" }}>10:50:02</span>
                  <span className="log-tag-accent">TRACK</span>
                  <span>Lead vehicle identified at distance 18.4m</span>
                </div>
                <div className="cockpit-log-item mono">
                  <span style={{ color: "var(--text-muted)" }}>10:50:03</span>
                  <span className="log-tag-accent">PREDICT</span>
                  <span>Actor trajectory horizon 3.0s (94% conf)</span>
                </div>
                <div className="cockpit-log-item mono">
                  <span style={{ color: "var(--text-muted)" }}>10:50:03</span>
                  <span className="log-tag-accent">RISK</span>
                  <span>TTC threshold calculated: {data.ttc}</span>
                </div>
                <div className="cockpit-log-item mono">
                  <span style={{ color: "var(--text-muted)" }}>10:50:04</span>
                  <span className="log-tag-accent">PLAN</span>
                  <span>4 candidate splines evaluated in {data.latency}</span>
                </div>
                <div className="cockpit-log-item mono" style={{ borderLeft: "2px solid var(--accent)", paddingLeft: "6px" }}>
                  <span style={{ color: "var(--text-muted)" }}>10:50:04</span>
                  <span className="log-tag-accent">SELECT</span>
                  <span>Trajectory C selected: {data.decision}</span>
                </div>
                <div className="cockpit-log-item mono">
                  <span style={{ color: "var(--text-muted)" }}>10:50:05</span>
                  <span className="log-tag-accent">ACTUATE</span>
                  <span>Command issued: Steer {data.steering}, Brake {data.brake}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================
          PERSISTENT AUTOMOTIVE BOTTOM DOCK (REF 1 & 2 HOMAGE)
      {/* =========================================================
          PERSISTENT AUTOMOTIVE RESEARCH FOOTER (REQUIRED)
      ========================================================= */}
      <footer className="cockpit-footer">
        <div className="footer-col-left">
          <span>© 2026 Horizon Carla SuperDrive</span>
        </div>
        <div className="footer-col-center">
          <span>Adaptive Autonomous Driving Research Platform</span>
          <span className="footer-meta-sep">•</span>
          <span className="footer-meta-tag">CARLA Simulation • Adaptive Path Planning • Risk Analysis</span>
        </div>
        <div className="footer-col-right">
          <span>Developed by Cortex</span>
        </div>
      </footer>
    </div>
  );
}

export default App;