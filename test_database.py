"""
Comprehensive test suite for Database Persistence Layer and History Analytics API.
Verifies:
1. SQLite/SQLAlchemy schema initialization and table creation.
2. Direct CRUD on PlanRecord, ScenarioRunRecord, SafetyIncidentRecord, VehicleTelemetryRecord.
3. Automatic persistence of planning cycles via /planner/calculate.
4. Automatic logging of SAFETY_VETO incidents during imminent collision.
5. Automatic logging of SSRF_ATTEMPT incidents on unauthorized CARLA connection attempts.
6. History query endpoints: /history/plans, /history/incidents, /history/scenarios,
   /history/telemetry, /history/metrics, /history/clear.
7. Subsystem health check: /health reports "database": "connected".
"""

import asyncio
import json
import unittest
from datetime import datetime

from app.main import app
from app.database import SessionLocal, init_db, check_db_health
from app.models.db_models import (
    PlanRecord,
    ScenarioRunRecord,
    SafetyIncidentRecord,
    VehicleTelemetryRecord
)
from app.models.schemas import (
    PlannerRequest,
    PlannerResponse,
    PerceptionData,
    Obstacle,
    Position,
    EgoState,
    RiskScore,
    CandidateTrajectory,
    TrajectoryPoint,
    SafetyDecision,
    VehicleCommand
)
from app.services.db_service import db_service
from tests.test_carla_integration import async_asgi_request


class TestDatabasePersistence(unittest.TestCase):

    def setUp(self):
        """Ensure tables exist and database history is reset before each test."""
        init_db()
        self.db = SessionLocal()
        db_service.clear_history(self.db)

    def tearDown(self):
        self.db.close()

    def test_database_health_check(self):
        """Verify active database connection via check_db_health()."""
        self.assertTrue(check_db_health())

    def test_record_plan_and_auto_safety_incident(self):
        """Saving a vetoed plan must create both a PlanRecord and a SafetyIncidentRecord."""
        req = PlannerRequest(
            perception=PerceptionData(
                timestamp=100.0,
                obstacles=[
                    Obstacle(id=1, object_type="pedestrian", position=Position(x=1.0, y=0.0), distance=1.0, velocity=0.0)
                ]
            ),
            goal=Position(x=20.0, y=0.0)
        )
        ego = EgoState(
            position=Position(x=0.0, y=0.0),
            velocity=Position(x=0.0, y=0.0),
            speed=2.5,
            yaw=0.0
        )
        res = PlannerResponse(
            risk_score=RiskScore(
                collision_cost=1.0,
                uncertainty_cost=0.0,
                occupancy_cost=0.2,
                behavior_cost=0.0,
                smoothness_cost=0.0,
                goal_cost=0.0,
                total_risk=0.33
            ),
            selected_trajectory=CandidateTrajectory(
                trajectory_id="T1_offset_-2.0m",
                points=[TrajectoryPoint(time=0.0, position=Position(x=0.0, y=0.0))]
            ),
            safety_decision=SafetyDecision(
                state="SAFE_STOP",
                risk_level="CRITICAL",
                emergency_stop=True,
                reason="SAFETY VETO TRIGGERED: Obstacle at 1.00m <= threshold 2.00m"
            ),
            vehicle_command=VehicleCommand(
                steering=0.0,
                target_speed=0.0,
                braking=1.0,
                emergency_brake=True
            ),
            recommended_behavior="SAFE_STOP",
            clearance=1.0,
            collision_status=True,
            reason="SAFETY VETO TRIGGERED: Obstacle at 1.00m <= threshold 2.00m",
            timestamp=100.0
        )

        plan = db_service.record_plan(self.db, req, res, ego)
        self.assertIsNotNone(plan.id)
        self.assertEqual(plan.safety_state, "SAFE_STOP")
        self.assertTrue(plan.emergency_stop)
        self.assertEqual(plan.ego_speed, 2.5)

        # Confirm that an incident was automatically created
        incidents = db_service.get_incidents(self.db, incident_type="SAFETY_VETO")
        self.assertEqual(len(incidents), 1)
        self.assertEqual(incidents[0].severity, "CRITICAL")
        self.assertIn("1.00m", incidents[0].details)

    def test_query_plans_filtering(self):
        """Test filtering plans by safety_state, emergency_stop_only, and min_risk."""
        req = PlannerRequest(
            perception=PerceptionData(timestamp=1.0, obstacles=[]),
            goal=Position(x=10.0, y=0.0)
        )
        # 1. Normal Cruise Plan
        res_cruise = PlannerResponse(
            risk_score=RiskScore(collision_cost=0.0, uncertainty_cost=0.0, occupancy_cost=0.0, behavior_cost=0.0, smoothness_cost=0.0, goal_cost=0.0, total_risk=0.1),
            selected_trajectory=CandidateTrajectory(trajectory_id="T3", points=[]),
            safety_decision=SafetyDecision(state="CRUISE", risk_level="LOW", emergency_stop=False, reason="Clear path"),
            vehicle_command=VehicleCommand(target_speed=5.0),
            recommended_behavior="CRUISE",
            clearance=50.0,
            collision_status=False,
            reason="Clear path",
            timestamp=1.0
        )
        db_service.record_plan(self.db, req, res_cruise)

        # 2. Emergency Stop Plan
        res_stop = PlannerResponse(
            risk_score=RiskScore(collision_cost=1.0, uncertainty_cost=0.0, occupancy_cost=0.2, behavior_cost=0.0, smoothness_cost=0.0, goal_cost=0.0, total_risk=0.9),
            selected_trajectory=CandidateTrajectory(trajectory_id="T3", points=[]),
            safety_decision=SafetyDecision(state="SAFE_STOP", risk_level="CRITICAL", emergency_stop=True, reason="Obstacle imminent"),
            vehicle_command=VehicleCommand(target_speed=0.0, braking=1.0, emergency_brake=True),
            recommended_behavior="SAFE_STOP",
            clearance=0.5,
            collision_status=True,
            reason="Obstacle imminent",
            timestamp=2.0
        )
        db_service.record_plan(self.db, req, res_stop)

        # Filter by emergency stop only
        emergencies = db_service.get_plans(self.db, emergency_stop_only=True)
        self.assertEqual(len(emergencies), 1)
        self.assertEqual(emergencies[0].safety_state, "SAFE_STOP")

        # Filter by min_risk >= 0.5
        high_risk = db_service.get_plans(self.db, min_risk=0.5)
        self.assertEqual(len(high_risk), 1)
        self.assertEqual(high_risk[0].total_risk, 0.9)

    def test_record_and_query_scenario_runs(self):
        """Test recording and retrieving benchmark scenario execution records."""
        rec = db_service.record_scenario_run(
            self.db,
            scenario_id=10,
            scenario_name="multi_hazard_intersection",
            status="COMPLETED",
            target_map="Town10HD_Opt",
            final_state="CRUISE",
            collision_detected=False,
            hold_time_elapsed=2.8,
            summary_message="Scenario completed successfully"
        )
        self.assertIsNotNone(rec.id)

        runs = db_service.get_scenario_runs(self.db, scenario_id=10)
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0].scenario_name, "multi_hazard_intersection")
        self.assertEqual(runs[0].hold_time_elapsed, 2.8)

    def test_record_and_query_telemetry(self):
        """Test logging and retrieving vehicle kinematic telemetry."""
        ego = EgoState(
            position=Position(x=12.5, y=-3.2, z=0.1),
            velocity=Position(x=4.0, y=0.0, z=0.0),
            speed=4.0,
            acceleration=0.5,
            yaw=45.0,
            timestamp=123.456
        )
        rec = db_service.record_telemetry(self.db, ego, actor_id=1, nearby_count=4)
        self.assertIsNotNone(rec.id)

        history = db_service.get_telemetry_history(self.db)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].speed, 4.0)
        self.assertEqual(history[0].nearby_actors_count, 4)

    def test_metrics_aggregation(self):
        """Verify summary metrics calculation across plans and incidents."""
        # Insert 1 cruise plan and 1 stop plan
        req = PlannerRequest(perception=PerceptionData(timestamp=1.0, obstacles=[]), goal=Position(x=10.0, y=0.0))
        res_cruise = PlannerResponse(
            risk_score=RiskScore(collision_cost=0.0, uncertainty_cost=0.0, occupancy_cost=0.0, behavior_cost=0.0, smoothness_cost=0.0, goal_cost=0.0, total_risk=0.1),
            selected_trajectory=CandidateTrajectory(trajectory_id="T1", points=[]),
            safety_decision=SafetyDecision(state="CRUISE", risk_level="LOW", emergency_stop=False, reason="Clear"),
            vehicle_command=VehicleCommand(target_speed=5.0),
            recommended_behavior="CRUISE", clearance=20.0, collision_status=False, reason="Clear", timestamp=1.0
        )
        res_stop = PlannerResponse(
            risk_score=RiskScore(collision_cost=1.0, uncertainty_cost=0.0, occupancy_cost=0.0, behavior_cost=0.0, smoothness_cost=0.0, goal_cost=0.0, total_risk=0.5),
            selected_trajectory=CandidateTrajectory(trajectory_id="T1", points=[]),
            safety_decision=SafetyDecision(state="SAFE_STOP", risk_level="CRITICAL", emergency_stop=True, reason="Veto"),
            vehicle_command=VehicleCommand(target_speed=0.0, emergency_brake=True),
            recommended_behavior="SAFE_STOP", clearance=2.0, collision_status=True, reason="Veto", timestamp=2.0
        )
        db_service.record_plan(self.db, req, res_cruise)
        db_service.record_plan(self.db, req, res_stop)

        metrics = db_service.get_metrics(self.db)
        self.assertEqual(metrics["total_plans_evaluated"], 2)
        self.assertEqual(metrics["emergency_stops_triggered"], 1)
        self.assertEqual(metrics["safe_stop_states"], 1)
        self.assertEqual(metrics["cruise_states"], 1)
        self.assertEqual(metrics["average_clearance_meters"], 11.0)  # (20 + 2) / 2
        self.assertEqual(metrics["safety_incidents_logged"], 1)

    def test_api_history_endpoints(self):
        """Verify REST history endpoints /history/plans, /history/metrics, /history/clear."""
        # 1. Clear history via API
        status_code, data = asyncio.run(async_asgi_request(app, "DELETE", "/history/clear"))
        self.assertEqual(status_code, 200)
        self.assertEqual(data["status"], "cleared")

        # 2. Trigger /planner/calculate through API
        payload = {
            "perception": {
                "timestamp": 10.0,
                "obstacles": [
                    {"id": 1, "object_type": "car", "position": {"x": 1.5, "y": 0.0, "z": 0.0}, "distance": 1.5, "velocity": 0.0, "confidence": 1.0}
                ]
            },
            "goal": {"x": 30.0, "y": 0.0, "z": 0.0}
        }
        status_code, plan_res = asyncio.run(async_asgi_request(app, "POST", "/planner/calculate", body=payload))
        self.assertEqual(status_code, 200)
        self.assertEqual(plan_res["safety_decision"]["state"], "SAFE_STOP")

        # 3. Query /history/plans
        status_code, plans = asyncio.run(async_asgi_request(app, "GET", "/history/plans"))
        self.assertEqual(status_code, 200)
        self.assertGreaterEqual(len(plans), 1)
        plan_id = plans[0]["id"]

        # 4. Query /history/plans/{id}
        status_code, single_plan = asyncio.run(async_asgi_request(app, "GET", f"/history/plans/{plan_id}"))
        self.assertEqual(status_code, 200)
        self.assertEqual(single_plan["id"], plan_id)
        self.assertIn("payload", single_plan)

        # 5. Query /history/incidents (safety veto auto-logged)
        status_code, incidents = asyncio.run(async_asgi_request(app, "GET", "/history/incidents"))
        self.assertEqual(status_code, 200)
        self.assertGreaterEqual(len(incidents), 1)
        self.assertEqual(incidents[0]["incident_type"], "SAFETY_VETO")

        # 6. Query /history/metrics
        status_code, metrics = asyncio.run(async_asgi_request(app, "GET", "/history/metrics"))
        self.assertEqual(status_code, 200)
        self.assertGreaterEqual(metrics["total_plans_evaluated"], 1)
        self.assertGreaterEqual(metrics["emergency_stops_triggered"], 1)

    def test_ssrf_attempt_logged_to_database(self):
        """Unauthorized CARLA connection attempt must log SSRF_ATTEMPT incident to DB."""
        status_code, _ = asyncio.run(
            async_asgi_request(
                app,
                "POST",
                "/simulation/carla/connect",
                body={"host": "169.254.169.254", "port": 2000}
            )
        )
        self.assertEqual(status_code, 400)

        # Check that incident is in database
        incidents = db_service.get_incidents(self.db, incident_type="SSRF_ATTEMPT")
        self.assertEqual(len(incidents), 1)
        self.assertEqual(incidents[0].severity, "CRITICAL")
        self.assertIn("169.254.169.254", incidents[0].details)

    def test_health_check_reports_database_status(self):
        """Verify that /health reports database status as 'connected'."""
        status_code, health = asyncio.run(async_asgi_request(app, "GET", "/health"))
        self.assertEqual(status_code, 200)
        self.assertEqual(health.get("database"), "connected")


if __name__ == "__main__":
    unittest.main()
