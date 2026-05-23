import math
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from scipy.stats import poisson


DEFAULT_HOME_GOALS = 1.45
DEFAULT_AWAY_GOALS = 1.15
DEFAULT_TOTAL_LINES = (1.5, 2.5, 3.5)
MODEL_NAME = "poisson"
MODEL_VERSION = "poisson-v1"


def estimate_expected_goals(match, history_df=None):
    history = history_df if history_df is not None else pd.DataFrame()
    if history.empty:
        return DEFAULT_HOME_GOALS, DEFAULT_AWAY_GOALS

    home_team_id = match["home_team_id"]
    away_team_id = match["away_team_id"]

    home_for = _team_goals_for(history, home_team_id)
    home_against = _team_goals_against(history, home_team_id)
    away_for = _team_goals_for(history, away_team_id)
    away_against = _team_goals_against(history, away_team_id)

    home_attack = _safe_mean(home_for, DEFAULT_HOME_GOALS)
    home_defense_allowed = _safe_mean(home_against, DEFAULT_AWAY_GOALS)
    away_attack = _safe_mean(away_for, DEFAULT_AWAY_GOALS)
    away_defense_allowed = _safe_mean(away_against, DEFAULT_HOME_GOALS)

    home_expected = np.mean([home_attack, away_defense_allowed, DEFAULT_HOME_GOALS])
    away_expected = np.mean([away_attack, home_defense_allowed, DEFAULT_AWAY_GOALS])

    return _clamp_goal_rate(home_expected), _clamp_goal_rate(away_expected)


def scoreline_matrix(home_expected_goals, away_expected_goals, max_goals=10):
    home_goals = np.arange(max_goals + 1)
    away_goals = np.arange(max_goals + 1)
    home_probs = poisson.pmf(home_goals, home_expected_goals)
    away_probs = poisson.pmf(away_goals, away_expected_goals)
    matrix = np.outer(home_probs, away_probs)

    total = matrix.sum()
    if total <= 0:
        raise ValueError("Scoreline matrix produced zero probability mass.")

    return matrix / total


def calculate_1x2_probabilities(matrix):
    home_win = float(np.tril(matrix, -1).sum())
    draw = float(np.trace(matrix))
    away_win = float(np.triu(matrix, 1).sum())

    return _normalize_probabilities(
        {
            "HOME": home_win,
            "DRAW": draw,
            "AWAY": away_win,
        }
    )


def calculate_over_under_probabilities(matrix, lines=DEFAULT_TOTAL_LINES):
    probabilities = {}
    home_indices, away_indices = np.indices(matrix.shape)
    total_goals = home_indices + away_indices

    for line in lines:
      over = float(matrix[total_goals > line].sum())
      under = float(matrix[total_goals < line].sum())
      probabilities[line] = _normalize_probabilities({"OVER": over, "UNDER": under})

    return probabilities


def calculate_btts_probabilities(matrix):
    home_indices, away_indices = np.indices(matrix.shape)
    yes = float(matrix[(home_indices > 0) & (away_indices > 0)].sum())
    no = float(matrix[(home_indices == 0) | (away_indices == 0)].sum())

    return _normalize_probabilities({"YES": yes, "NO": no})


def generate_predictions(match, history_df=None, model_version=MODEL_VERSION, generated_at=None):
    generated_at = generated_at or datetime.now(timezone.utc)
    home_xg, away_xg = estimate_expected_goals(match, history_df)
    matrix = scoreline_matrix(home_xg, away_xg)
    rows = []

    for selection, probability in calculate_1x2_probabilities(matrix).items():
        rows.append(
            _prediction_row(
                match["id"],
                "MONEYLINE",
                selection,
                probability,
                home_xg,
                away_xg,
                model_version,
                generated_at,
            )
        )

    for line, outcomes in calculate_over_under_probabilities(matrix).items():
        for side, probability in outcomes.items():
            rows.append(
                _prediction_row(
                    match["id"],
                    "TOTAL",
                    f"{side}_{line}",
                    probability,
                    home_xg,
                    away_xg,
                    model_version,
                    generated_at,
                )
            )

    for selection, probability in calculate_btts_probabilities(matrix).items():
        rows.append(
            _prediction_row(
                match["id"],
                "BTTS",
                selection,
                probability,
                home_xg,
                away_xg,
                model_version,
                generated_at,
            )
        )

    return rows


def _prediction_row(
    match_id,
    market,
    selection,
    probability,
    home_xg,
    away_xg,
    model_version,
    generated_at,
):
    probability = _round_probability(probability)
    fair_price = round(1 / probability, 4) if probability > 0 else None

    return {
        "match_id": match_id,
        "model_name": MODEL_NAME,
        "model_version": model_version,
        "market": market,
        "selection": selection,
        "fair_probability": probability,
        "fair_price_decimal": fair_price,
        "edge_pct": 0.0,
        "rationale": (
            f"Deterministic Poisson model: home_xg={home_xg:.3f}, "
            f"away_xg={away_xg:.3f}"
        ),
        "created_at": generated_at,
    }


def _team_goals_for(history, team_id):
    home_goals = history.loc[history["home_team_id"] == team_id, "home_score"]
    away_goals = history.loc[history["away_team_id"] == team_id, "away_score"]
    return pd.concat([home_goals, away_goals], ignore_index=True)


def _team_goals_against(history, team_id):
    home_against = history.loc[history["home_team_id"] == team_id, "away_score"]
    away_against = history.loc[history["away_team_id"] == team_id, "home_score"]
    return pd.concat([home_against, away_against], ignore_index=True)


def _safe_mean(values, fallback):
    clean_values = pd.to_numeric(values, errors="coerce").dropna()
    if clean_values.empty:
        return fallback
    return float(clean_values.mean())


def _clamp_goal_rate(value):
    return float(np.clip(value, 0.2, 5.0))


def _normalize_probabilities(probabilities):
    total = sum(probabilities.values())
    if total <= 0 or not math.isfinite(total):
        raise ValueError("Probability total must be finite and positive.")

    normalized = {
        key: _round_probability(value / total)
        for key, value in probabilities.items()
    }
    drift = round(1.0 - sum(normalized.values()), 6)
    if drift:
        largest_key = max(normalized, key=normalized.get)
        normalized[largest_key] = _round_probability(normalized[largest_key] + drift)

    return normalized


def _round_probability(value):
    return round(float(value), 6)
