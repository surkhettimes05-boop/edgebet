from db import (
    create_db_engine,
    fetch_recent_results,
    fetch_upcoming_matches,
    save_predictions,
)
from poisson import MODEL_VERSION, generate_predictions


def main():
    print("EdgeBet basketball prediction worker initialized")

    try:
        engine = create_db_engine()
    except (RuntimeError, ValueError) as error:
        print(f"[basketball] skipped: {error}")
        return {
            "connected": False,
            "matches": 0,
            "predictions": 0,
            "saved": 0,
        }

    with engine.connect() as connection:
        connection.exec_driver_sql("SELECT 1")
    print("[basketball] database connected")

    matches = fetch_upcoming_matches(engine)
    history = fetch_recent_results(engine)
    print(f"[basketball] upcoming matches loaded: {len(matches)}")

    predictions = []
    for match in matches.to_dict("records"):
        predictions.extend(generate_predictions(match, history, model_version=MODEL_VERSION))

    saved = save_predictions(engine, predictions)
    print(f"[basketball] generated probabilities: {len(predictions)}")
    print(f"[basketball] saved predictions: {saved}")

    return {
        "connected": True,
        "matches": len(matches),
        "predictions": len(predictions),
        "saved": saved,
    }


if __name__ == "__main__":
    main()
