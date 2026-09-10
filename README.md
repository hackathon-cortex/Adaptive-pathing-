
# Autonomous Vehicle Risk Planning System

**SIH 2026 — Production-Grade Backend & CARLA 0.10.0 Simulation Integration**

---

## 1. Project Overview

The **Autonomous Vehicle Risk Planning System** is a safety-critical, risk-aware autonomous driving backend engineered for **CARLA 0.10.0** on **Town10HD_Opt**, validated against benchmark **Scenarios 1–10**.

The system establishes an end-to-end perception, prediction, risk planning, and vehicle control pipeline that enforces an **Unconditional Safety Veto** to guarantee collision prevention while maintaining high motion smoothness and navigation progress.

---

## 2. Target Architecture

```text
                     CARLA 0.10.0 (Town10HD_Opt)
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  CarlaService   │
                         │   Connection    │
                         │      World      │
                         │ Filtered Actors │
                         └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                 EgoState     Perception     Sensors
                    │             │.           |

                    │             ▼
                    │         Obstacles
                    │        Pedestrians
                    │         Vehicles
                    │             │
                    │             ▼
                    │    Dynamic Prediction
                    │     (Spatio-Temporal)
                    │             │
                    └─────────────┼─────────────┘
                                  ▼
                         Risk Assessment
                                  │
                                  ▼
                        Candidate Trajectories
                                  │
                                  ▼
                         SAFETY VETO CHECK
                                  │
                           ┌──────┴──────┐
                           │             │
                         SAFE         UNSAFE (dist <= 2.0m or cost >= 0.8)
                           │             │
                           ▼             ▼
                        Optimal      SAFE_STOP
                       Trajectory  (Emerg Brake = 1.0)
                           │             │
                           └──────┬──────┘
                                  ▼
                            VehicleCommand
                                  │
                                  ▼
                          VehicleController
                                  │
                                  ▼
                         CARLA Simulator
                                  │
                                  ▼
                        Next Simulation Tick
```

---

## 3. Core Capabilities & Safety Guarantees

1. **Unconditional Safety Veto**:
   - If the minimum obstacle distance $\le 2.0\text{m}$ OR collision cost $\ge 0.8$, the system unconditionally overrides weighted scoring, forces `SAFE_STOP`, sets `emergency_brake = True`, `braking = 1.0`, and `target_speed = 0.0`.
   - Weighted addition is **never** permitted to dilute an imminent collision.
2. **Dynamic Spatio-Temporal Prediction Checking**:
   - Compares candidate trajectory points $(x_{\text{ego}}(t), y_{\text{ego}}(t))$ against future predicted obstacle coordinates $(x_{\text{obs}}(t), y_{\text{obs}}(t))$ at matching timestamps, preventing collisions with oncoming or cutting-in traffic.
3. **Multi-Hazard Latching State Machine (Scenario 10 Reference)**:
   - Validated state transitions: `CRUISE` $\rightarrow$ `YIELD` $\rightarrow$ `STOP` $\rightarrow$ `HOLD` ($\ge 2.5\text{s}$) $\rightarrow$ `RESUME` $\rightarrow$ `CRUISE`.
   - Physical stop confirmation: requires ego speed $\le 0.1\text{ m/s}$ before latching `HOLD`.
   - Latches pedestrian and vehicle clearances independently. Will **not** resume until all hazards are clear.
4. **CARLA 0.10.0 Security & Performance**:
   - **SSRF Protection**: Connection targets strictly validated against allowed hosts (`CARLA_ALLOWED_HOSTS`) and port ranges `[1024, 65535]`.
   - **Optimized Actor Filtering**: Uses native `filter("*vehicle*")` and `filter("*walker*")` instead of scanning all static meshes.
   - **Real Sensor Discovery**: Discovers attached sensors dynamically; reports `available: false` when offline rather than returning mock data.
5. **CORS & Operational Resilience**:
   - Configurable `CORSMiddleware` supporting React/Vite frontends on `localhost:3000` and `localhost:5173`.
   - Structured Python logging across all modules.
   - Safe HTTP exception responses avoiding internal stack trace leakage.
6. **Production Database Persistence & Historical Analytics**:
   - Integrated **SQLAlchemy 2.0** ORM with local SQLite storage (`./av_system.db`), easily configured to PostgreSQL in production via `DATABASE_URL`.
   - Automatically persists planning cycles, risk breakdowns, candidate trajectories, and computed vehicle commands.
   - Dedicated audit logging for **Unconditional Safety Veto** triggers and **SSRF security attempts**.
   - Chronological vehicle telemetry stream and benchmark scenario execution records.

---

## 4. Benchmark Scenarios (1–10)

| Scenario ID | Name | Target Map | Primary Hazards & Expected Behavior |
| :--- | :--- | :--- | :--- |
| **Scenario 1** | `obstacle_stop` | Town10HD_Opt | Static obstacle ahead; detect, decelerate, and stop smoothly. |
| **Scenario 2** | `pedestrian_crossing` | Town10HD_Opt | Pedestrian crossing; YIELD, STOP, HOLD until pedestrian clears. |
| **Scenario 3** | `sudden_obstacle` | Town10HD_Opt | Unexpected obstacle cut-in within 2m; triggers unconditional Safety Veto. |
| **Scenario 4** | `red_light_intersection` | Town10HD_Opt | Red light intersection; stop at stop line, hold, resume on green. |
| **Scenario 5** | `vehicle_cut_in` | Town10HD_Opt | Adjacent vehicle cutting in; gap recovery and cautious approach. |
| **Scenario 6** | `blocked_lane` | Town10HD_Opt | Construction obstacle; lateral offset candidate trajectory selection. |
| **Scenario 7** | `emergency_vehicle` | Town10HD_Opt | Approaching siren emergency vehicle; pull over or yield right-of-way. |
| **Scenario 8** | `parked_vehicle` | Town10HD_Opt | Parked vehicle hazard; lateral clearance maintenance. |
| **Scenario 9** | `following_vehicle` | Town10HD_Opt | Decelerating lead vehicle; safe headway following. |
| **Scenario 10** | `multi_obstacle` | Town10HD_Opt | **Regression Gold Standard**: Crossing pedestrian + blocking vehicle. `CRUISE` $\rightarrow$ `YIELD` $\rightarrow$ `STOP` (speed $\le 0.1\text{ m/s}$) $\rightarrow$ `HOLD` ($\ge 2.5\text{s}$) $\rightarrow$ latch ped clearance $\rightarrow$ latch vehicle clearance $\rightarrow$ `RESUME` $\rightarrow$ `CRUISE`. |

---

## 5. Getting Started

### Prerequisites
- Python 3.9+
- CARLA Simulator 0.10.0 (Optional for unit tests; required for live physics simulation)

### Installation
```bash
# Clone or navigate to the repository
cd "/Users/saudrana/Backend_Adaptive "

# Create and activate virtual environment
python3 -m venv app/venv
source app/venv/bin/activate

# Install locked dependencies
pip install -r requirements.txt
```

### Running the Backend
Start the canonical FastAPI server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Interactive API documentation will be available at:
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`

---

## 6. Environment Configuration

Configuration is managed via environment variables (or `.env` file):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `CARLA_HOST` | `127.0.0.1` | Host IP address of the CARLA simulator |
| `CARLA_PORT` | `2000` | Port of CARLA simulator RPC server |
| `CARLA_TIMEOUT` | `5.0` | Socket timeout in seconds |
| `CARLA_ALLOWED_HOSTS` | `127.0.0.1,localhost` | Whitelist for SSRF protection |
| `API_KEY` | `sih-av-risk-planner-2026` | Secret API key for endpoint authentication |
| `API_KEY_ENABLED` | `True` | Enable/disable API key authentication |
| `API_KEY_HEADER_NAME` | `X-API-Key` | Custom header name for API key |
| `DATABASE_URL` | `sqlite:///./av_system.db` | SQLAlchemy database connection URI |
| `DB_ECHO` | `False` | Enable SQLAlchemy query logging |
| `DB_AUTO_RECORD` | `True` | Automatically persist planning cycles and scenario runs |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Allowed frontend origins |
| `SAFETY_DISTANCE_THRESHOLD`| `2.0` | Minimum emergency stopping distance in meters |
| `EMERGENCY_COLLISION_COST` | `0.8` | Collision cost threshold for Safety Veto |
| `HOLD_DURATION_SECONDS` | `2.5` | Minimum standstill duration in seconds |
| `LOG_LEVEL` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`) |

---

## 7. Authentication & API Key Usage

Protected endpoints require the **`X-API-Key`** header:
```bash
# Example 1: Query system metrics
curl -s -X GET http://localhost:8000/history/metrics \
  -H "X-API-Key: sih-av-risk-planner-2026"

# Example 2: Trigger risk planning calculation
curl -s -X POST http://localhost:8000/planner/calculate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sih-av-risk-planner-2026" \
  -d '{"perception": {"timestamp": 100.0, "obstacles": []}, "goal": {"x": 50.0, "y": 0.0}}'
```

Public endpoints (no key required):
- `GET /`
- `GET /health`
- `/docs` and `/redoc` (Swagger UI includes an **Authorize** button to enter the API key)

---

## 8. Running the Automated Test Suite

Run the full test suite with 100% pass rate (40/40 passing):
```bash
# Run all tests using unittest
./app/venv/bin/python -m unittest discover tests

# Or run specific test modules:
./app/venv/bin/python -m unittest tests/test_api_security.py
./app/venv/bin/python -m unittest tests/test_database.py
./app/venv/bin/python -m unittest tests/test_safety_veto.py
./app/venv/bin/python -m unittest tests/test_dynamic_prediction.py
./app/venv/bin/python -m unittest tests/test_state_machine.py
./app/venv/bin/python -m unittest tests/test_api_security.py
./app/venv/bin/python -m unittest tests/test_carla_integration.py
```

---

## 8. API Endpoints Reference

### Health & Info
- `GET /` — Root system info, map, simulator, database status, and version metadata.
- `GET /health` — Subsystem-aware health check returning discrete statuses for API, database, CARLA connection, Risk Planner, and Prediction module.

### Risk Planner
- `GET /planner/status` — Returns planner health and current state machine state.
- `POST /planner/calculate` — Computes optimal candidate trajectory, composite risk score, safety decision, and validated vehicle command (persists to DB).

### Historical Analytics & Audit
- `GET /history/plans` — Query past planning evaluations with filters (`safety_state`, `emergency_stop_only`, `min_risk`).
- `GET /history/plans/{id}` — Retrieve single planning cycle with full payload JSON.
- `GET /history/incidents` — Audit log of safety veto triggers and security events (SSRF blocks).
- `GET /history/scenarios` — Query benchmark scenario run history.
- `GET /history/telemetry` — Query historical vehicle trajectory and speed series.
- `GET /history/metrics` — Aggregate system metrics (total evaluations, emergency stop count, average clearance).
- `DELETE /history/clear` — Reset historical records for test and benchmark isolation.

### CARLA Simulation
- `GET /simulation/carla/status` — Live simulator connection status.
- `POST /simulation/carla/connect` — Connects to CARLA with SSRF validation (logs security incidents).
- `POST /simulation/carla/disconnect` — Gracefully disconnects session.
- `GET /simulation/carla/world` — Current simulation time, map name, actor count.
- `GET /simulation/carla/vehicle` — Ego vehicle transform, velocity, acceleration, yaw.
- `GET /simulation/carla/actors` — Filtered list of dynamic actors.
- `GET /simulation/carla/obstacles` — Ground-truth obstacles with relative coordinate frames.
- `GET /simulation/carla/perception/breakdown` — Multi-hazard breakdown.
- `GET /simulation/carla/sensors` — Real discovered ego vehicle sensors.
- `POST /simulation/carla/control` — Applies `VehicleCommand` directly to CARLA ego vehicle.

### Scenarios (1–10)
- `GET /simulation/scenarios` — Lists all 10 benchmark scenarios.
- `GET /simulation/scenarios/{name}/status` — Status of specific benchmark scenario.
- `POST /simulation/scenarios/{name}/start` — Starts scenario execution and logs to DB.
- `POST /simulation/scenarios/{name}/stop` — Stops scenario, logs completion, and cleans up actors.
=======
# Adaptive-pathing-
# Autonomous Vehicle Risk Planning System

An AI-driven autonomous vehicle risk planning and decision-making system designed to improve vehicle safety in dynamic and uncertain driving environments.

The system integrates simulation, perception, motion prediction, uncertainty estimation, risk-aware trajectory planning, safety decision-making, and vehicle control into a unified autonomous driving pipeline.

---

## 🚗 System Overview

The system follows a modular autonomous driving architecture:

CARLA Simulator
        ↓
Perception
        ↓
Motion Prediction
        ↓
Risk Assessment
        ↓
Risk-Aware Trajectory Planning
        ↓
Safety / State Decision
        ↓
Vehicle Control
        ↓
Evaluation & Visualization

The primary objective is to enable an autonomous vehicle to identify potential hazards, estimate future motion, calculate risk, select a safer trajectory, and generate appropriate driving behavior.

---

## 🎯 Key Objectives

- Detect and represent surrounding obstacles
- Predict future motion of dynamic objects
- Estimate prediction uncertainty
- Calculate collision and environmental risk
- Generate multiple candidate trajectories
- Evaluate trajectories using risk-aware cost functions
- Select the safest feasible trajectory
- Generate adaptive driving behaviors
- Support emergency stopping decisions
- Integrate the complete pipeline with CARLA simulation
- Provide real-time backend APIs for autonomous driving modules

---

## 🧠 Risk Planning

The Risk Planner evaluates multiple factors to calculate an overall risk score.

### Risk Components

- Collision Risk
- Prediction Uncertainty
- Occupancy Risk
- Behavior Risk
- Trajectory Smoothness
- Goal Cost

The overall risk score is normalized between:

`0.0 → 1.0`

### Behavior Selection

| Risk Score | Behavior |
|------------|----------|
| `< 0.25` | CRUISE |
| `0.25 – 0.49` | CREEP_NEGOTIATE |
| `0.50 – 0.74` | CAUTIOUS_APPROACH |
| `≥ 0.75` | SAFE_STOP |

This allows the vehicle to adapt its behavior according to the current driving risk.

---

## 🛣️ CARLA Simulation

CARLA is used as the primary autonomous driving simulation environment.

The simulator provides:

- Road environments
- Vehicles
- Pedestrians
- Dynamic traffic
- Vehicle state
- Object positions
- Object velocities
- Simulation scenarios
- Sensor simulation

The backend is designed to receive CARLA simulation data and pass it through the autonomous driving pipeline.

---

## 🔬 Core Architecture

### 1. Perception

Responsible for understanding the surrounding environment using sensor and perception data.

Outputs include:

- Object ID
- Object type
- Position
- Velocity
- Distance
- Detection confidence

---

### 2. Motion Prediction

Predicts the future motion of detected dynamic objects.

Prediction includes:

- Future positions
- Multiple possible trajectories
- Motion uncertainty
- Object intent

Example intents:

- Crossing
- Lane Change
- Braking
- Continue

---

### 3. Risk Planner

The Risk Planner combines perception and prediction information to determine the current driving risk.

It performs:

1. Collision risk calculation
2. Uncertainty evaluation
3. Occupancy evaluation
4. Candidate trajectory generation
5. Trajectory evaluation
6. Risk-aware trajectory selection
7. Driving behavior selection

---

### 4. Safety Decision

The selected behavior is passed to the safety layer.

Possible decisions include:

- CRUISE
- CREEP
- CAUTIOUS APPROACH
- SAFE STOP
- EMERGENCY STOP

---

### 5. Vehicle Control

The control layer converts high-level safety decisions into vehicle commands such as:

- Steering
- Speed
- Acceleration
- Braking
- Emergency braking

---

## ⚙️ Backend

The backend is built using:

- Python
- FastAPI
- Pydantic
- REST APIs

### Current API Structure

```text
GET  /
GET  /health

GET  /planner/status
POST /planner/calculate

GET  /simulation/carla/status
POST /simulation/carla/connect
POST /simulation/carla/disconnect
GET  /simulation/carla/world
GET  /simulation/carla/vehicle
GET  /simulation/carla/actors
GET  /simulation/carla/obstacles
>>>>>>> b8895d6abf7a6b20bad31646f2823e7ef46ad44c

---

## AI Model Directory

The AI perception and prediction pipelines require pre-trained model weights
that are **not** committed to version control (they are large binary files).
After cloning the repository, obtain the weights from your model registry
(MLflow, Weights & Biases, DVC, or shared team storage) and place them at
the exact paths listed below.

| File | Path | Description |
| :--- | :--- | :--- |
| **best.pt** | `core/perception/models/best.pt` | YOLOv8 / YOLOv9 object-detection weights used by the perception pipeline to detect vehicles, pedestrians, cyclists, and static obstacles in camera frames. |
| **trajectory.pkl** | `core/prediction/weights/trajectory.pkl` | Serialised trajectory-prediction model (e.g., sklearn Pipeline or PyTorch state dict saved via `joblib`). Predicts future positions of detected dynamic objects. |
| **intent.pkl** | `core/prediction/weights/intent.pkl` | Serialised intent-classification model. Classifies the likely behaviour of each tracked object (e.g., *crossing*, *lane-change*, *braking*, *continue*). |
| **scaler.pkl** | `core/prediction/weights/scaler.pkl` | Fitted feature scaler (`StandardScaler` / `MinMaxScaler`) used during training. Must be the same scaler applied at inference time to ensure consistent feature normalisation. |

### Loading weights at runtime

```python
import joblib
from ultralytics import YOLO  # only when YOLO integration is enabled

# Perception
yolo_model = YOLO("core/perception/models/best.pt")

# Prediction
trajectory_model = joblib.load("core/prediction/weights/trajectory.pkl")
intent_model     = joblib.load("core/prediction/weights/intent.pkl")
scaler           = joblib.load("core/prediction/weights/scaler.pkl")
```

### .gitignore

Ensure these binary paths are excluded from version control:

```text
core/perception/models/*.pt
core/prediction/weights/*.pkl
```
