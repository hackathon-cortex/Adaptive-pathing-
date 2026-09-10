"""
Security and API hardening test suite.
Verifies:
1. SSRF Protection: Arbitrary/internal hosts rejected by /simulation/carla/connect.
2. Port range enforcement: Ports outside [1024, 65535] rejected.
3. Subsystem Health Check: /health exposes discrete status for all modules.
4. Benchmark Scenario Endpoints: /simulation/scenarios lists all 10 scenarios.
5. Command input validation: Invalid steering, braking, or speed rejected.
"""

import asyncio
import unittest
from pydantic import ValidationError

from app.main import app
from app.models.schemas import VehicleCommand
from tests.test_carla_integration import async_asgi_request


class TestApiSecurityAndHardening(unittest.TestCase):

    def test_ssrf_protection_rejects_arbitrary_host(self):
        """Attacker providing AWS metadata IP 169.254.169.254 is blocked."""
        status, data = asyncio.run(
            async_asgi_request(
                app,
                "POST",
                "/simulation/carla/connect",
                body={"host": "169.254.169.254", "port": 2000}
            )
        )
        self.assertEqual(status, 400)
        self.assertIn("detail", data)
        self.assertEqual(data["detail"]["error"], "INVALID_HOST_OR_PORT")

    def test_port_validation_rejects_low_port(self):
        """Privileged/system port 80 or 22 rejected."""
        status, data = asyncio.run(
            async_asgi_request(
                app,
                "POST",
                "/simulation/carla/connect",
                body={"host": "127.0.0.1", "port": 80}
            )
        )
        self.assertEqual(status, 400)
        self.assertEqual(data["detail"]["error"], "INVALID_HOST_OR_PORT")

    def test_health_check_subsystem_reporting(self):
        """Health endpoint reports discrete subsystem statuses."""
        status, data = asyncio.run(async_asgi_request(app, "GET", "/health"))
        self.assertEqual(status, 200)
        self.assertEqual(data["api"], "healthy")
        self.assertEqual(data["planner"], "ready")
        self.assertEqual(data["prediction"], "ready")
        self.assertIn(data["carla"], ["connected", "disconnected"])

    def test_scenarios_listing(self):
        """Benchmark scenario endpoint returns all 10 Scenarios."""
        status, data = asyncio.run(async_asgi_request(app, "GET", "/simulation/scenarios"))
        self.assertEqual(status, 200)
        self.assertEqual(len(data), 10)
        scenario_names = [s["name"] for s in data]
        self.assertIn("obstacle_stop", scenario_names)
        self.assertIn("pedestrian_crossing", scenario_names)
        self.assertIn("multi_obstacle", scenario_names)

    def test_vehicle_command_validation(self):
        """VehicleCommand schema rejects out-of-bounds steering and braking values."""
        # Valid command
        cmd = VehicleCommand(steering=0.5, target_speed=10.0, braking=0.2)
        self.assertEqual(cmd.steering, 0.5)

        # Invalid steering (> 1.0)
        with self.assertRaises(ValidationError):
            VehicleCommand(steering=1.5, target_speed=10.0, braking=0.2)

        # Invalid braking (> 1.0)
        with self.assertRaises(ValidationError):
            VehicleCommand(steering=0.0, target_speed=10.0, braking=1.5)

        # Invalid speed (< 0.0)
        with self.assertRaises(ValidationError):
            VehicleCommand(steering=0.0, target_speed=-5.0, braking=0.0)

    def test_missing_api_key_rejected(self):
        """Protected endpoint /planner/status returns 401 if X-API-Key header is missing."""
        headers_without_key = [
            (b"content-type", b"application/json"),
            (b"content-length", b"0")
        ]
        status, data = asyncio.run(
            async_asgi_request(app, "GET", "/planner/status", headers=headers_without_key)
        )
        self.assertEqual(status, 401)
        self.assertEqual(data.get("detail", {}).get("error"), "UNAUTHORIZED")

    def test_invalid_api_key_rejected(self):
        """Protected endpoint /history/metrics returns 401 if X-API-Key is incorrect."""
        wrong_headers = [
            (b"content-type", b"application/json"),
            (b"content-length", b"0"),
            (b"x-api-key", b"wrong-forbidden-key")
        ]
        status, data = asyncio.run(
            async_asgi_request(app, "GET", "/history/metrics", headers=wrong_headers)
        )
        self.assertEqual(status, 401)
        self.assertEqual(data.get("detail", {}).get("error"), "UNAUTHORIZED")

    def test_valid_api_key_accepted(self):
        """Protected endpoint returns 200 when valid X-API-Key is provided."""
        valid_headers = [
            (b"content-type", b"application/json"),
            (b"content-length", b"0"),
            (b"x-api-key", b"sih-av-risk-planner-2026")
        ]
        status, data = asyncio.run(
            async_asgi_request(app, "GET", "/planner/status", headers=valid_headers)
        )
        self.assertEqual(status, 200)
        self.assertEqual(data.get("planner"), "Risk Planner")

    def test_public_endpoints_accessible_without_api_key(self):
        """Public endpoints / and /health do not require an API key."""
        headers_without_key = [
            (b"content-type", b"application/json"),
            (b"content-length", b"0")
        ]
        status_root, data_root = asyncio.run(
            async_asgi_request(app, "GET", "/", headers=headers_without_key)
        )
        self.assertEqual(status_root, 200)
        self.assertEqual(data_root.get("status"), "running")

        status_health, data_health = asyncio.run(
            async_asgi_request(app, "GET", "/health", headers=headers_without_key)
        )
        self.assertEqual(status_health, 200)
        self.assertEqual(data_health.get("api"), "healthy")

    def test_unauthorized_access_logged_to_database(self):
        """Failed authentication attempts are automatically recorded to safety_incident_records."""
        from app.database import SessionLocal
        from app.services.db_service import db_service

        db = SessionLocal()
        try:
            wrong_headers = [
                (b"content-type", b"application/json"),
                (b"content-length", b"0"),
                (b"x-api-key", b"attacker-fake-key")
            ]
            status, _ = asyncio.run(
                async_asgi_request(app, "GET", "/simulation/scenarios", headers=wrong_headers)
            )
            self.assertEqual(status, 401)

            incidents = db_service.get_incidents(db, incident_type="UNAUTHORIZED_ACCESS")
            self.assertGreaterEqual(len(incidents), 1)
            self.assertEqual(incidents[0].severity, "WARNING")
            self.assertIn("missing or invalid", incidents[0].details)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
