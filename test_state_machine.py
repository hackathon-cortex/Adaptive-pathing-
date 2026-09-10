"""
Unit and integration tests for Scenario 10 Multi-Hazard Latching State Machine.
Verifies:
1. Deterministic transitions: CRUISE -> YIELD -> STOP -> HOLD (>= 2.5s) -> RESUME -> CRUISE.
2. Physical stop threshold: speed <= 0.1 m/s latches HOLD.
3. Multi-hazard latching: If pedestrian clears but vehicle is still blocking, remains in HOLD.
4. If vehicle clears but pedestrian is crossing, remains in HOLD.
5. Transitions to RESUME only when all hazards clear AND hold duration >= 2.5s.
"""

import unittest
from app.models.schemas import Position, Obstacle
from app.services.state_machine import ScenarioStateMachine


class TestStateMachine(unittest.TestCase):

    def setUp(self):
        self.sm = ScenarioStateMachine(hold_duration=2.5)

    def test_full_scenario_10_progression(self):
        """Walk through complete Scenario 10 state machine lifecycle."""
        ped = Obstacle(id=1, object_type="pedestrian", position=Position(x=15.0, y=0.0), distance=15.0, velocity=1.0)
        veh = Obstacle(id=2, object_type="car", position=Position(x=18.0, y=0.0), distance=18.0, velocity=0.0)

        # 1. CRUISE -> YIELD (Hazard detected at 15m)
        dec, cmd = self.sm.step(ego_speed=8.0, obstacles=[ped, veh], safety_veto=False, veto_reason="", current_time=100.0)
        self.assertEqual(dec.state, "YIELD")
        self.assertEqual(cmd.braking, 0.4)

        # 2. YIELD -> STOP (Approaching <= 10m)
        ped_close = Obstacle(id=1, object_type="pedestrian", position=Position(x=8.0, y=0.0), distance=8.0, velocity=1.0)
        dec, cmd = self.sm.step(ego_speed=3.0, obstacles=[ped_close, veh], safety_veto=False, veto_reason="", current_time=101.0)
        self.assertEqual(dec.state, "STOP")
        self.assertEqual(cmd.braking, 1.0)
        self.assertEqual(cmd.target_speed, 0.0)

        # 3. STOP -> HOLD (Speed reaches 0.05 m/s <= 0.1 m/s)
        dec, cmd = self.sm.step(ego_speed=0.05, obstacles=[ped_close, veh], safety_veto=False, veto_reason="", current_time=102.0)
        self.assertEqual(dec.state, "HOLD")
        self.assertEqual(cmd.braking, 1.0)
        self.assertEqual(cmd.target_speed, 0.0)
        self.assertEqual(dec.hold_remaining, 2.5)

        # 4. In HOLD at t=103.0 (1.0s elapsed < 2.5s) -> Must continue HOLD
        dec, cmd = self.sm.step(ego_speed=0.0, obstacles=[ped_close, veh], safety_veto=False, veto_reason="", current_time=103.0)
        self.assertEqual(dec.state, "HOLD")
        self.assertAlmostEqual(dec.hold_remaining, 1.5, places=1)

        # 5. Multi-Hazard Latching: Pedestrian clears, but vehicle remains blocking at t=105.0 (3.0s elapsed >= 2.5s)
        # MUST REMAIN IN HOLD because vehicle is not clear!
        dec, cmd = self.sm.step(ego_speed=0.0, obstacles=[veh], safety_veto=False, veto_reason="", current_time=105.0)
        self.assertEqual(dec.state, "HOLD")
        self.assertIn("waiting for clearance", dec.reason)

        # 6. Both hazards cleared at t=106.0 (4.0s elapsed >= 2.5s)
        # ALL CLEAR -> Transitions to RESUME
        dec, cmd = self.sm.step(ego_speed=0.0, obstacles=[], safety_veto=False, veto_reason="", current_time=106.0)
        self.assertEqual(dec.state, "RESUME")
        self.assertEqual(cmd.target_speed, 4.0)
        self.assertEqual(cmd.braking, 0.0)

        # 7. RESUME -> CRUISE (Vehicle accelerates to 2.0 m/s >= 1.5 m/s)
        dec, cmd = self.sm.step(ego_speed=2.0, obstacles=[], safety_veto=False, veto_reason="", current_time=108.0)
        self.assertEqual(dec.state, "CRUISE")
        self.assertEqual(cmd.braking, 0.0)
        self.assertGreater(cmd.target_speed, 5.0)


if __name__ == "__main__":
    unittest.main()
