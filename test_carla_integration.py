"""
Comprehensive integration test suite for CARLA Simulator integration
and verification of existing Risk Planner functionality.
"""

import asyncio
import json
import unittest
from unittest.mock import MagicMock, patch

from app.main import app
from app.models.schemas import (
    PlannerRequest,
    PerceptionData,
    Obstacle,
    Position,
    PredictionData,
    CarlaConnectionStatus,
    CarlaVehicleState,
    CarlaWorldState
)
from app.services.carla_service import (
    carla_service,
    CarlaNotConnectedError,
    CarlaVehicleNotFoundError
)


async def async_asgi_request(
    app,
    method: str,
    path: str,
    body: dict = None,
    query_string: str = "",
    headers: list = None
) -> tuple[int, dict]:
    """Lightweight ASGI request executor avoiding external test dependencies like httpx."""
    body_bytes = json.dumps(body).encode("utf-8") if body is not None else b""
    if headers is None:
        headers = [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body_bytes)).encode("utf-8")),
            (b"x-api-key", b"sih-av-risk-planner-2026")
        ]

    response_headers = []
    response_body = []
    response_status = 200

    async def receive():
        return {
            "type": "http.request",
            "body": body_bytes,
            "more_body": False
        }

    async def send(message):
        nonlocal response_status, response_headers, response_body
        if message["type"] == "http.response.start":
            response_status = message["status"]
            response_headers = message.get("headers", [])
        elif message["type"] == "http.response.body":
            response_body.append(message.get("body", b""))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": query_string.encode("utf-8"),
        "headers": headers,
        "client": ("127.0.0.1", 50000),
        "server": ("127.0.0.1", 8000),
    }

    await app(scope, receive, send)

    raw_body = b"".join(response_body).decode("utf-8")
    try:
        data = json.loads(raw_body) if raw_body else {}
    except Exception:
        data = {"raw": raw_body}

    return response_status, data


class TestExistingBackend(unittest.TestCase):
    """Verify that existing backend endpoints and Risk Planner are 100% preserved."""

    def test_root_endpoint(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/"))
        self.assertEqual(status, 200)
        self.assertEqual(data.get("status"), "running")
        self.assertEqual(data.get("developer"), "Saud Rana")

    def test_health_endpoint(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/health"))
        self.assertEqual(status, 200)
        self.assertEqual(data.get("api"), "healthy")
        self.assertIn("carla", data)
        self.assertIn("planner", data)

    def test_planner_status_endpoint(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/planner/status"))
        self.assertEqual(status, 200)
        self.assertEqual(data.get("planner"), "Risk Planner")
        self.assertEqual(data.get("status"), "active")

    def test_planner_calculate_endpoint(self):
        payload = {
            "perception": {
                "timestamp": 12.34,
                "obstacles": [
                    {
                        "id": 101,
                        "object_type": "car",
                        "position": {"x": 5.0, "y": 0.0, "z": 0.0},
                        "distance": 5.0,
                        "velocity": 10.0,
                        "confidence": 0.95
                    }
                ]
            },
            "predictions": [
                {
                    "obstacle_id": 101,
                    "current_velocity": 10.0,
                    "predictions": [
                        {
                            "time": 1.0,
                            "position": {"x": 15.0, "y": 0.0, "z": 0.0},
                            "probability": 0.8
                        }
                    ],
                    "uncertainty": 0.2,
                    "intent": "CRUISE"
                }
            ],
            "goal": {"x": 50.0, "y": 0.0, "z": 0.0}
        }

        status, data = asyncio.run(async_asgi_request(app, "POST", "/planner/calculate", body=payload))
        self.assertEqual(status, 200)
        self.assertIn("risk_score", data)
        self.assertIn("selected_trajectory", data)
        self.assertIn("recommended_behavior", data)
        self.assertGreater(data["risk_score"]["total_risk"], 0.0)


class TestCarlaOfflineBehavior(unittest.TestCase):
    """Verify CARLA endpoints handle simulator absence cleanly without crashing."""

    def setUp(self):
        carla_service.disconnect()

    def test_carla_status_when_offline(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/simulation/carla/status"))
        self.assertEqual(status, 200)
        self.assertFalse(data.get("connected"))
        self.assertIn("message", data)

    def test_carla_connect_when_offline(self):
        status, data = asyncio.run(async_asgi_request(app, "POST", "/simulation/carla/connect", body={"host": "127.0.0.1", "port": 2000}))
        self.assertEqual(status, 200)
        self.assertFalse(data.get("connected"))

    def test_carla_world_when_offline(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/simulation/carla/world"))
        self.assertEqual(status, 503)
        self.assertIn("detail", data)

    def test_carla_vehicle_when_offline(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/simulation/carla/vehicle"))
        self.assertEqual(status, 503)
        self.assertIn("detail", data)

    def test_carla_actors_when_offline(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/simulation/carla/actors"))
        self.assertEqual(status, 503)

    def test_carla_obstacles_when_offline(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/simulation/carla/obstacles"))
        self.assertEqual(status, 503)

    def test_carla_perception_when_offline(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/simulation/carla/perception"))
        self.assertEqual(status, 503)

    def test_carla_sensors_endpoint(self):
        status, data = asyncio.run(async_asgi_request(app, "GET", "/simulation/carla/sensors"))
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)
        self.assertTrue(len(data) >= 1)


class TestCarlaMockIntegration(unittest.TestCase):
    """Verify CARLA service logic, schema conversion, and pipeline compatibility using mocks."""

    def test_mock_carla_pipeline(self):
        mock_world = MagicMock()
        mock_map = MagicMock()
        mock_map.name = "Town10HD_Opt"
        mock_world.get_map.return_value = mock_map

        mock_snapshot = MagicMock()
        mock_snapshot.timestamp.elapsed_seconds = 100.5
        mock_snapshot.timestamp.delta_seconds = 0.05
        mock_world.get_snapshot.return_value = mock_snapshot

        # Ego vehicle
        mock_ego = MagicMock()
        mock_ego.id = 1
        mock_ego.type_id = "vehicle.tesla.model3"
        mock_ego.attributes = {"role_name": "hero"}
        mock_ego.is_alive = True
        mock_ego_transform = MagicMock()
        mock_ego_transform.location.x = 0.0
        mock_ego_transform.location.y = 0.0
        mock_ego_transform.location.z = 0.0
        mock_ego_transform.rotation.yaw = 90.0
        mock_ego.get_transform.return_value = mock_ego_transform
        mock_ego_vel = MagicMock()
        mock_ego_vel.x = 5.0
        mock_ego_vel.y = 0.0
        mock_ego_vel.z = 0.0
        mock_ego.get_velocity.return_value = mock_ego_vel
        mock_ego_acc = MagicMock()
        mock_ego_acc.x = 1.0
        mock_ego_acc.y = 0.0
        mock_ego_acc.z = 0.0
        mock_ego.get_acceleration.return_value = mock_ego_acc

        # Other dynamic actors: vehicle 2 and pedestrian 3
        mock_actor_veh = MagicMock()
        mock_actor_veh.id = 2
        mock_actor_veh.type_id = "vehicle.audi.tt"
        mock_actor_veh.attributes = {}
        mock_actor_veh_loc = MagicMock()
        mock_actor_veh_loc.x = 8.0
        mock_actor_veh_loc.y = 0.0
        mock_actor_veh_loc.z = 0.0
        mock_actor_veh_tf = MagicMock()
        mock_actor_veh_tf.location = mock_actor_veh_loc
        mock_actor_veh.get_transform.return_value = mock_actor_veh_tf
        mock_actor_veh_vel = MagicMock()
        mock_actor_veh_vel.x = 4.0
        mock_actor_veh_vel.y = 0.0
        mock_actor_veh_vel.z = 0.0
        mock_actor_veh.get_velocity.return_value = mock_actor_veh_vel

        mock_actor_ped = MagicMock()
        mock_actor_ped.id = 3
        mock_actor_ped.type_id = "walker.pedestrian.0001"
        mock_actor_ped.attributes = {}
        mock_actor_ped_loc = MagicMock()
        mock_actor_ped_loc.x = 4.0
        mock_actor_ped_loc.y = 0.0
        mock_actor_ped_loc.z = 0.0
        mock_actor_ped_tf = MagicMock()
        mock_actor_ped_tf.location = mock_actor_ped_loc
        mock_actor_ped.get_transform.return_value = mock_actor_ped_tf
        mock_actor_ped_vel = MagicMock()
        mock_actor_ped_vel.x = 1.0
        mock_actor_ped_vel.y = 0.0
        mock_actor_ped_vel.z = 0.0
        mock_actor_ped.get_velocity.return_value = mock_actor_ped_vel

        mock_vehicles = MagicMock()
        mock_vehicles.__iter__.side_effect = lambda: iter([mock_ego, mock_actor_veh])
        mock_vehicles.__len__.return_value = 2

        mock_walkers = MagicMock()
        mock_walkers.__iter__.side_effect = lambda: iter([mock_actor_ped])
        mock_walkers.__len__.return_value = 1

        mock_actor_list = MagicMock()
        def mock_filter(pattern):
            if "vehicle" in pattern:
                return [mock_ego, mock_actor_veh]
            elif "walker" in pattern:
                return [mock_actor_ped]
            elif "sensor" in pattern:
                return []
            return []
        mock_actor_list.filter.side_effect = mock_filter
        mock_actor_list.__iter__.side_effect = lambda: iter([mock_ego, mock_actor_veh, mock_actor_ped])
        mock_actor_list.__len__.return_value = 3
        mock_world.get_actors.return_value = mock_actor_list

        carla_service._world = mock_world
        carla_service._client = MagicMock()

        with patch.object(carla_service, "is_connected", return_value=True):
            world_info = carla_service.get_world_info()
            self.assertEqual(world_info.map_name, "Town10HD_Opt")
            self.assertEqual(world_info.simulation_time, 100.5)

            ego_state = carla_service.get_vehicle_state()
            self.assertEqual(ego_state.actor_id, 1)
            self.assertEqual(ego_state.x, 0.0)
            self.assertEqual(ego_state.velocity, 5.0)

            actors = carla_service.get_nearby_actors(radius=50.0)
            self.assertEqual(len(actors), 2)
            self.assertEqual(actors[0].actor_id, 3)

            obstacles = carla_service.get_obstacles(radius=50.0)
            self.assertEqual(len(obstacles), 2)
            self.assertEqual(obstacles[0].id, 3)

            perception = carla_service.get_perception_data(radius=50.0)
            self.assertEqual(len(perception.obstacles), 2)

            planner_payload = {
                "perception": perception.model_dump(),
                "predictions": [],
                "goal": {"x": 30.0, "y": 0.0, "z": 0.0}
            }
            status, plan_res = asyncio.run(
                async_asgi_request(app, "POST", "/planner/calculate", body=planner_payload)
            )
            self.assertEqual(status, 200)
            self.assertIn("risk_score", plan_res)
            self.assertIn("selected_trajectory", plan_res)
            self.assertIn("safety_decision", plan_res)
            self.assertIn("vehicle_command", plan_res)

        # Missing ego vehicle handling
        empty_actor_list = MagicMock()
        empty_actor_list.filter.return_value = []
        mock_world.get_actors.return_value = empty_actor_list
        carla_service._ego_vehicle = None

        with patch.object(carla_service, "is_connected", return_value=True):
            status, data = asyncio.run(async_asgi_request(app, "GET", "/simulation/carla/vehicle"))
            self.assertEqual(status, 404)

        carla_service.disconnect()


if __name__ == "__main__":
    unittest.main()
