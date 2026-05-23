import unittest

import numpy as np
import pandas as pd

from poisson import (
    calculate_btts_probabilities,
    calculate_over_under_probabilities,
    calculate_1x2_probabilities,
    estimate_expected_goals,
    generate_predictions,
    scoreline_matrix,
)


class PoissonEngineTest(unittest.TestCase):
    def test_scoreline_matrix_is_deterministic_probability_distribution(self):
        matrix = scoreline_matrix(1.4, 1.1, max_goals=10)

        self.assertEqual(matrix.shape, (11, 11))
        self.assertAlmostEqual(float(matrix.sum()), 1.0, places=6)
        self.assertGreater(matrix[1, 1], matrix[5, 5])

    def test_calculates_core_market_probabilities(self):
        matrix = scoreline_matrix(1.5, 1.0, max_goals=10)

        result_1x2 = calculate_1x2_probabilities(matrix)
        totals = calculate_over_under_probabilities(matrix, lines=(2.5,))
        btts = calculate_btts_probabilities(matrix)

        self.assertAlmostEqual(sum(result_1x2.values()), 1.0, places=6)
        self.assertAlmostEqual(totals[2.5]["OVER"] + totals[2.5]["UNDER"], 1.0, places=6)
        self.assertAlmostEqual(btts["YES"] + btts["NO"], 1.0, places=6)
        self.assertGreater(result_1x2["HOME"], result_1x2["AWAY"])

    def test_estimates_expected_goals_from_recent_results(self):
        match = {
            "home_team_id": "home",
            "away_team_id": "away",
            "league_id": "league",
        }
        history = pd.DataFrame(
            [
                {"home_team_id": "home", "away_team_id": "x", "home_score": 3, "away_score": 1},
                {"home_team_id": "x", "away_team_id": "home", "home_score": 0, "away_score": 2},
                {"home_team_id": "away", "away_team_id": "x", "home_score": 1, "away_score": 1},
                {"home_team_id": "x", "away_team_id": "away", "home_score": 2, "away_score": 0},
            ]
        )

        home_xg, away_xg = estimate_expected_goals(match, history)

        self.assertGreater(home_xg, away_xg)
        self.assertGreater(home_xg, 0.2)
        self.assertGreater(away_xg, 0.2)

    def test_generates_prediction_rows_for_match(self):
        match = {
            "id": "match-1",
            "home_team_id": "home",
            "away_team_id": "away",
            "league_id": "league",
        }

        rows = generate_predictions(match, pd.DataFrame(), model_version="test-v1")

        markets = {(row["market"], row["selection"]) for row in rows}
        self.assertIn(("MONEYLINE", "HOME"), markets)
        self.assertIn(("MONEYLINE", "DRAW"), markets)
        self.assertIn(("MONEYLINE", "AWAY"), markets)
        self.assertIn(("TOTAL", "OVER_2.5"), markets)
        self.assertIn(("BTTS", "YES"), markets)
        self.assertTrue(all(np.isfinite(row["fair_probability"]) for row in rows))


if __name__ == "__main__":
    unittest.main()
