import unittest
from unittest.mock import patch

from db import create_db_engine


class DatabaseLayerTest(unittest.TestCase):
    def test_reports_missing_postgres_driver_cleanly(self):
        with patch("db.create_engine", side_effect=ModuleNotFoundError("No module named 'psycopg2'")):
            with self.assertRaises(RuntimeError) as context:
                create_db_engine("postgresql://user:pass@host:5432/db")

        self.assertIn("PostgreSQL driver", str(context.exception))


if __name__ == "__main__":
    unittest.main()
