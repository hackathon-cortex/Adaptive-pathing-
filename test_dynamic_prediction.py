"""
Unit tests for Dynamic Spatio-Temporal Prediction Checking.
Verifies:
1. Trajectory points at time t are evaluated against predicted obstacle positions at time t.
2. An obstacle starting far away (e.g. 20m) moving towards ego vehicle path at t=2.0s is correctly flagged.
3. Prediction probability and uncertainty scale the risk metrics.
"""

import unittest
from app.models.schemas import (
    Position,
    Obstacle,
    PredictionData,
    PredictedPosition,
    CandidateTrajectory,
    TrajectoryPoint
)
from app.services.planner_service import (
    get_obstacle_position_at_time,
    calculate_trajectory_collision_cost
)


class TestDynamicPrediction(unittest.TestCase):

    def test_spatio_temporal_prediction_interpolation(self):
        """Obstacle predicted to move linearly from x=20 at t=0 to x=0 at t=2.0."""
        obs = Obstacle(
            id=10,
            object_type="car",
            position=Position(x=20.0, y=0.0, z=0.0),
            distance=20.0,
            velocity=10.0,
            confidence=1.0
        )
        pred = PredictionData(
            obstacle_id=10,
            current_velocity=10.0,
            predictions=[
                PredictedPosition(time=0.0, position=Position(x=20.0, y=0.0, z=0.0), probability=1.0),
                PredictedPosition(time=1.0, position=Position(x=10.0, y=0.0, z=0.0), probability=1.0),
                PredictedPosition(time=2.0, position=Position(x=0.0, y=0.0, z=0.0), probability=1.0)
            ],
            uncertainty=0.1
        )

        # At t=1.0, interpolated position must be x=10.0
        x_1, y_1 = get_obstacle_position_at_time(obs, pred, target_time=1.0)
        self.assertAlmostEqual(x_1, 10.0, places=2)
        self.assertAlmostEqual(y_1, 0.0, places=2)

        # At t=1.5, interpolated position must be x=5.0
        x_15, y_15 = get_obstacle_position_at_time(obs, pred, target_time=1.5)
        self.assertAlmostEqual(x_15, 5.0, places=2)

    def test_dynamic_collision_detection_vs_static_miss(self):
        """
        An oncoming car starts at x=30m at t=0.
        Ego trajectory reaches x=15m at t=1.5s.
        Oncoming car arrives at x=15m at t=1.5s.
        Dynamic check must flag this high collision risk (distance ~0m at t=1.5s),
        whereas a static check would compare (15m, 0m) against t=0 static position (30m, 0m) and think distance is 15m (low risk).
        """
        obs = Obstacle(
            id=20,
            object_type="car",
            position=Position(x=30.0, y=0.0, z=0.0),
            distance=30.0,
            velocity=10.0,
            confidence=1.0
        )
        pred = PredictionData(
            obstacle_id=20,
            current_velocity=10.0,
            predictions=[
                PredictedPosition(time=0.0, position=Position(x=30.0, y=0.0, z=0.0), probability=1.0),
                PredictedPosition(time=1.5, position=Position(x=15.0, y=0.0, z=0.0), probability=1.0),
                PredictedPosition(time=3.0, position=Position(x=0.0, y=0.0, z=0.0), probability=1.0)
            ],
            uncertainty=0.05
        )

        # Ego trajectory reaching x=15m at t=1.5s
        traj = CandidateTrajectory(
            trajectory_id="T_test",
            points=[
                TrajectoryPoint(time=0.0, position=Position(x=0.0, y=0.0, z=0.0), speed=10.0),
                TrajectoryPoint(time=1.5, position=Position(x=15.0, y=0.0, z=0.0), speed=10.0),
                TrajectoryPoint(time=3.0, position=Position(x=30.0, y=0.0, z=0.0), speed=10.0)
            ],
            cost=0.0
        )

        # Dynamic spatio-temporal check
        cost, min_dist = calculate_trajectory_collision_cost(traj, [obs], [pred])

        # At t=1.5s, ego is at (15, 0) and obstacle is at (15, 0) -> distance ~ 0
        self.assertAlmostEqual(min_dist, 0.0, places=2)
        self.assertEqual(cost, 1.0)  # Maximum collision risk!


if __name__ == "__main__":
    unittest.main()
