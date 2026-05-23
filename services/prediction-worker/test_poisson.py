import unittest

import numpy as np
import pandas as pd

from poisson import (
    calculate_moneyline_probabilities,
    calculate_nba_total_probabilities,
    estimate_expected_points,
    generate_predictions,
    score_margin_distribution,
)


class PoissonEngineTest(unittest.TestCase):
    def test_score_margin_distribution_is_deterministic_probability_distribution(self):
        margins = score_margin_distribution(4.5, spread_stddev=12)

        self.assertAlmostEqual(sum(margins.values()), 1.0, places=6)
        self.assertGreater(margins[4], margins[24])

    def test_calculates_core_market_probabilities(self):
        margins = score_margin_distribution(4.5, spread_stddev=12)

        moneyline = calculate_moneyline_probabilities(margins)
        totals = calculate_nba_total_probabilities(226.5, total_stddev=18, lines=(224.5,))

        self.assertAlmostEqual(sum(moneyline.values()), 1.0, places=6)
        self.assertAlmostEqual(totals[224.5]["OVER"] + totals[224.5]["UNDER"], 1.0, places=6)
        self.assertGreater(moneyline["HOME"], moneyline["AWAY"])
        self.assertGreater(totals[224.5]["OVER"], totals[224.5]["UNDER"])

    def test_estimates_expected_points_from_recent_results(self):
        match = {
            "home_team_id": "home",
            "away_team_id": "away",
            "league_id": "league",
        }
        history = pd.DataFrame(
            [
                {"home_team_id": "home", "away_team_id": "x", "home_score": 121, "away_score": 107},
                {"home_team_id": "x", "away_team_id": "home", "home_score": 101, "away_score": 118},
                {"home_team_id": "away", "away_team_id": "x", "home_score": 105, "away_score": 111},
                {"home_team_id": "x", "away_team_id": "away", "home_score": 116, "away_score": 104},
            ]
        )

        home_points, away_points = estimate_expected_points(match, history)

        self.assertGreater(home_points, away_points)
        self.assertGreater(home_points, 80)
        self.assertGreater(away_points, 80)

    def test_generates_prediction_rows_for_match(self):
        match = {
            "id": "match-1",
            "home_team_id": "home",
            "away_team_id": "away",
            "league_id": "league",
            "league_name": "NBA",
        }

        rows = generate_predictions(match, pd.DataFrame(), model_version="test-v1")

        markets = {(row["market"], row["selection"]) for row in rows}
        self.assertIn(("MONEYLINE", "HOME"), markets)
        self.assertIn(("MONEYLINE", "AWAY"), markets)
        self.assertIn(("SPREAD", "HOME_-3.5"), markets)
        self.assertIn(("SPREAD", "AWAY_+3.5"), markets)
        self.assertIn(("TOTAL", "OVER_224.5"), markets)
        self.assertIn(("TOTAL", "UNDER_224.5"), markets)
        self.assertNotIn(("MONEYLINE", "DRAW"), markets)
        self.assertFalse(any(row["market"] == "BTTS" for row in rows))
        self.assertFalse(any("1.5" in row["selection"] for row in rows))
        self.assertTrue(all(np.isfinite(row["fair_probability"]) for row in rows))

    def test_generates_predictions_for_available_sportsbook_lines(self):
        match = {
            "id": "match-1",
            "home_team_id": "home",
            "away_team_id": "away",
            "home_team": "Cleveland Cavaliers",
            "away_team": "New York Knicks",
            "league_id": "league",
            "league_name": "NBA",
            "odds_lines": [
                {"market": "SPREAD", "selection": "Cleveland Cavaliers -2.5"},
                {"market": "SPREAD", "selection": "New York Knicks 2.5"},
                {"market": "TOTAL", "selection": "Over 215.5"},
                {"market": "TOTAL", "selection": "Under 215.5"},
            ],
        }

        rows = generate_predictions(match, pd.DataFrame(), model_version="test-v1")

        markets = {(row["market"], row["selection"]) for row in rows}
        self.assertIn(("SPREAD", "HOME_-2.5"), markets)
        self.assertIn(("SPREAD", "AWAY_+2.5"), markets)
        self.assertIn(("TOTAL", "OVER_215.5"), markets)
        self.assertIn(("TOTAL", "UNDER_215.5"), markets)
        self.assertNotIn(("SPREAD", "HOME_-3.5"), markets)
        self.assertNotIn(("TOTAL", "OVER_224.5"), markets)


if __name__ == "__main__":
    unittest.main()
