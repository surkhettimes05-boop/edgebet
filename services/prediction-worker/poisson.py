import math
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from scipy.stats import norm


DEFAULT_HOME_POINTS = 113.5
DEFAULT_AWAY_POINTS = 110.0
DEFAULT_SPREAD_LINES = (3.5,)
DEFAULT_TOTAL_LINES = (224.5,)
DEFAULT_SPREAD_STDDEV = 12.0
DEFAULT_TOTAL_STDDEV = 18.0
MODEL_NAME = "basketball_rating"
MODEL_VERSION = "basketball-v1"


def estimate_expected_points(match, history_df=None):
    history = history_df if history_df is not None else pd.DataFrame()
    if history.empty:
        return DEFAULT_HOME_POINTS, DEFAULT_AWAY_POINTS

    home_team_id = match["home_team_id"]
    away_team_id = match["away_team_id"]

    home_for = _team_points_for(history, home_team_id)
    home_against = _team_points_against(history, home_team_id)
    away_for = _team_points_for(history, away_team_id)
    away_against = _team_points_against(history, away_team_id)

    home_attack = _safe_mean(home_for, DEFAULT_HOME_POINTS)
    home_defense_allowed = _safe_mean(home_against, DEFAULT_AWAY_POINTS)
    away_attack = _safe_mean(away_for, DEFAULT_AWAY_POINTS)
    away_defense_allowed = _safe_mean(away_against, DEFAULT_HOME_POINTS)

    home_expected = np.mean([home_attack, away_defense_allowed, DEFAULT_HOME_POINTS])
    away_expected = np.mean([away_attack, home_defense_allowed, DEFAULT_AWAY_POINTS])

    return _clamp_points(home_expected), _clamp_points(away_expected)


def score_margin_distribution(expected_margin, spread_stddev=DEFAULT_SPREAD_STDDEV, limit=60):
    margins = range(-limit, limit + 1)
    probabilities = {}

    for margin in margins:
        lower = margin - 0.5
        upper = margin + 0.5
        probabilities[margin] = float(
            norm.cdf(upper, loc=expected_margin, scale=spread_stddev)
            - norm.cdf(lower, loc=expected_margin, scale=spread_stddev)
        )

    return _normalize_probabilities(probabilities)


def calculate_moneyline_probabilities(margin_distribution):
    home = sum(prob for margin, prob in margin_distribution.items() if margin > 0)
    away = sum(prob for margin, prob in margin_distribution.items() if margin < 0)
    push = margin_distribution.get(0, 0)

    return _normalize_probabilities(
        {
            "HOME": home + push / 2,
            "AWAY": away + push / 2,
        }
    )


def calculate_spread_probabilities(margin_distribution, lines=DEFAULT_SPREAD_LINES):
    probabilities = {}

    for line in lines:
        probabilities[line] = _normalize_probabilities(
            {
                f"HOME_-{line}": sum(
                    prob for margin, prob in margin_distribution.items() if margin > line
                ),
                f"AWAY_+{line}": sum(
                    prob for margin, prob in margin_distribution.items() if margin < line
                ),
            }
        )

    return probabilities


def calculate_spread_selection_probability(margin_distribution, side, handicap):
    if side == "HOME":
        return _round_probability(
            sum(prob for margin, prob in margin_distribution.items() if margin + handicap > 0)
        )
    if side == "AWAY":
        return _round_probability(
            sum(prob for margin, prob in margin_distribution.items() if -margin + handicap > 0)
        )
    raise ValueError(f"Unsupported spread side: {side}")


def calculate_nba_total_probabilities(expected_total, total_stddev=DEFAULT_TOTAL_STDDEV, lines=DEFAULT_TOTAL_LINES):
    probabilities = {}

    for line in lines:
        over = 1 - norm.cdf(line, loc=expected_total, scale=total_stddev)
        under = norm.cdf(line, loc=expected_total, scale=total_stddev)
        probabilities[line] = _normalize_probabilities({"OVER": float(over), "UNDER": float(under)})

    return probabilities


def generate_predictions(match, history_df=None, model_version=MODEL_VERSION, generated_at=None):
    generated_at = generated_at or datetime.now(timezone.utc)
    home_points, away_points = estimate_expected_points(match, history_df)
    expected_margin = home_points - away_points
    expected_total = home_points + away_points
    margin_distribution = score_margin_distribution(expected_margin)
    spread_lines = _available_spread_lines(match)
    total_lines = _available_total_lines(match)
    rows = []

    for selection, probability in calculate_moneyline_probabilities(margin_distribution).items():
        rows.append(
            _prediction_row(
                match["id"],
                "MONEYLINE",
                selection,
                probability,
                home_points,
                away_points,
                expected_margin,
                expected_total,
                model_version,
                generated_at,
            )
        )

    if spread_lines:
        for side, handicap in spread_lines:
            selection = f"{side}_{_format_signed_line(handicap)}"
            probability = calculate_spread_selection_probability(margin_distribution, side, handicap)
            rows.append(
                _prediction_row(
                    match["id"],
                    "SPREAD",
                    selection,
                    probability,
                    home_points,
                    away_points,
                    expected_margin,
                    expected_total,
                    model_version,
                    generated_at,
                )
            )
    else:
        for outcomes in calculate_spread_probabilities(margin_distribution).values():
            for selection, probability in outcomes.items():
                rows.append(
                    _prediction_row(
                        match["id"],
                        "SPREAD",
                        selection,
                        probability,
                        home_points,
                        away_points,
                        expected_margin,
                        expected_total,
                        model_version,
                        generated_at,
                    )
                )

    for line, outcomes in calculate_nba_total_probabilities(expected_total, lines=total_lines).items():
        for side, probability in outcomes.items():
            rows.append(
                _prediction_row(
                    match["id"],
                    "TOTAL",
                    f"{side}_{_format_line(line)}",
                    probability,
                    home_points,
                    away_points,
                    expected_margin,
                    expected_total,
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
    home_points,
    away_points,
    expected_margin,
    expected_total,
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
            f"Deterministic basketball model: home_pts={home_points:.1f}, "
            f"away_pts={away_points:.1f}, margin={expected_margin:.1f}, "
            f"total={expected_total:.1f}"
        ),
        "created_at": generated_at,
    }


def _team_points_for(history, team_id):
    home_points = history.loc[history["home_team_id"] == team_id, "home_score"]
    away_points = history.loc[history["away_team_id"] == team_id, "away_score"]
    return pd.concat([home_points, away_points], ignore_index=True)


def _team_points_against(history, team_id):
    home_against = history.loc[history["home_team_id"] == team_id, "away_score"]
    away_against = history.loc[history["away_team_id"] == team_id, "home_score"]
    return pd.concat([home_against, away_against], ignore_index=True)


def _safe_mean(values, fallback):
    clean_values = pd.to_numeric(values, errors="coerce").dropna()
    if clean_values.empty:
        return fallback
    return float(clean_values.mean())


def _clamp_points(value):
    return float(np.clip(value, 70.0, 160.0))


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


def _available_spread_lines(match):
    odds_lines = match.get("odds_lines") or []
    rows = []
    seen = set()
    home_team = match.get("home_team", "")
    away_team = match.get("away_team", "")

    for odds_line in odds_lines:
        if odds_line.get("market") != "SPREAD":
            continue

        selection = odds_line.get("selection", "")
        side = None
        if home_team and selection.startswith(home_team):
            side = "HOME"
            line_text = selection.removeprefix(home_team).strip()
        elif away_team and selection.startswith(away_team):
            side = "AWAY"
            line_text = selection.removeprefix(away_team).strip()
        else:
            continue

        try:
            handicap = float(line_text)
        except ValueError:
            continue

        key = (side, handicap)
        if key not in seen:
            seen.add(key)
            rows.append(key)

    return rows


def _available_total_lines(match):
    odds_lines = match.get("odds_lines") or []
    lines = []
    seen = set()

    for odds_line in odds_lines:
        if odds_line.get("market") != "TOTAL":
            continue

        parts = odds_line.get("selection", "").split()
        if len(parts) != 2 or parts[0].lower() not in {"over", "under"}:
            continue

        try:
            line = float(parts[1])
        except ValueError:
            continue

        if line not in seen:
            seen.add(line)
            lines.append(line)

    return tuple(lines) or DEFAULT_TOTAL_LINES


def _format_signed_line(value):
    sign = "+" if value > 0 else ""
    magnitude = _format_line(value)
    return f"{sign}{magnitude}"


def _format_line(value):
    return str(int(value)) if float(value).is_integer() else str(value)
