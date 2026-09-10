"""
Unit and integration tests for Unconditional Safety Veto.
Verifies that:
1. Obstacle <= 2.0m forces SAFE_STOP, emergency_stop=True, braking=1.0, emergency_brake=True.
2. Collision cost >= 0.8 forces SAFE_STOP.
3. Weighted arithmetic NEVER overrides imminent collision (resolving audit defect).
4. Safe distance (25m) performs normal CRUISE/YIELD without veto.
"""

import unittest
from app.models.schemas import (
    Position,
    Obstacle,
    PerceptionData,
    PredictionData,
    EgoState
)
from app.services.planner_service import (
    plan_safe_motion,
    check_safety_veto,
    calculate_risk
)
from app.services.state_machine import state_machine


class TestSafetyVeto(unittest.TestCase):

    def setUp(self):
        state_machine.reset()

    def test_1m_obstacle_triggers_safety_veto(self):
        """1.0m obstacle must trigger SAFE_STOP regardless of 0 uncertainty or 1 obstacle."""
        obstacles = [
            Obstacle(
                id=1,
                object_type="pedestrian",
                position=Position(x=1.0, y=0.0, z=0.0),
                distance=1.0,
                velocity=0.0,
                confidence=1.0
            )
        ]
        ego_state = EgoState(
            position=Position(x=0.0, y=0.0, z=0.0),
            velocity=Position(x=0.0, y=0.0, z=0.0),
            speed=2.0,
            acceleration=0.0,
            yaw=0.0,
            timestamp=100.0
        )
        goal = Position(x=50.0, y=0.0, z=0.0)

        risk, traj, decision, command, clearance, collision = plan_safe_motion(
            ego_state=ego_state,
            goal=goal,
            obstacles=obstacles,
            predictions=[]
        )

        # Verified assertions:
        self.assertEqual(decision.state, "SAFE_STOP")
        self.assertTrue(decision.emergency_stop)
        self.assertEqual(decision.risk_level, "CRITICAL")
        self.assertEqual(command.target_speed, 0.0)
        self.assertEqual(command.braking, 1.0)
        self.assertTrue(command.emergency_brake)
        self.assertTrue(collision)
        self.assertEqual(clearance, 1.0)

    def test_2m_threshold_boundary(self):
        """2.0m is the exact threshold boundary and must trigger safety veto."""
        veto_triggered, reason = check_safety_veto(min_obstacle_distance=2.0, collision_cost=1.0)
        self.assertTrue(veto_triggered)
        self.assertIn("SAFETY VETO TRIGGERED", reason)

    def test_collision_cost_threshold(self):
        """Collision cost >= 0.8 triggers safety veto even if distance is slightly larger."""
        veto_triggered, reason = check_safety_veto(min_obstacle_distance=3.5, collision_cost=0.8)
        self.assertTrue(veto_triggered)
        self.assertIn("Collision cost 0.80 >= emergency threshold 0.80", reason)

    def test_weighted_arithmetic_cannot_dilute_veto(self):
        """
        Regression test for audit defect:
        Collision cost 1.0 * 0.30 = 0.30 total risk.
        Verify that decision is STILL SAFE_STOP, not diluted to CREEP_NEGOTIATE.
        """
        obstacles = [
            Obstacle(
                id=99,
                object_type="car",
                position=Position(x=0.5, y=0.0, z=0.0),
                distance=0.5,
                velocity=0.0,
                confidence=1.0
            )
        ]
        ego_state = EgoState(
            position=Position(x=0.0, y=0.0, z=0.0),
            velocity=Position(x=0.0, y=0.0, z=0.0),
            speed=0.0,
            acceleration=0.0,
            yaw=0.0,
            timestamp=10.0
        )
        _, _, decision, command, _, _ = plan_safe_motion(
            ego_state=ego_state,
            goal=Position(x=20.0, y=0.0, z=0.0),
            obstacles=obstacles,
            predictions=[]
        )
        self.assertEqual(decision.state, "SAFE_STOP")
        self.assertTrue(command.emergency_brake)
        self.assertEqual(command.braking, 1.0)

    def test_safe_distance_normal_planning(self):
        """Obstacle at 30m does not trigger veto and allows normal CRUISE."""
        obstacles = [
            Obstacle(
                id=2,
                object_type="car",
                position=Position(x=30.0, y=0.0, z=0.0),
                distance=30.0,
                velocity=5.0,
                confidence=1.0
            )
        ]
        ego_state = EgoState(
            position=Position(x=0.0, y=0.0, z=0.0),
            velocity=Position(x=5.0, y=0.0, z=0.0),
            speed=5.0,
            acceleration=0.0,
            yaw=0.0,
            timestamp=10.0
        )
        _, _, decision, command, _, collision = plan_safe_motion(
            ego_state=ego_state,
            goal=Position(x=50.0, y=0.0, z=0.0),
            obstacles=obstacles,
            predictions=[]
        )
        self.assertEqual(decision.state, "CRUISE")
        self.assertFalse(decision.emergency_stop)
        self.assertFalse(command.emergency_brake)
        self.assertFalse(collision)
        self.assertGreater(command.target_speed, 0.0)


if __name__ == "__main__":
    unittest.main()
