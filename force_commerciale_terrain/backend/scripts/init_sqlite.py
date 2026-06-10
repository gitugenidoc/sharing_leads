from __future__ import annotations

import os
import sqlite3
from pathlib import Path


def resolve_database_path() -> Path:
    database_url = os.getenv("DATABASE_URL", "file:./dev.db")
    if not database_url.startswith("file:"):
        raise SystemExit(f"Unsupported DATABASE_URL for sqlite init: {database_url}")

    relative_path = database_url.removeprefix("file:")
    backend_root = Path(__file__).resolve().parent.parent
    return (backend_root / relative_path).resolve()


def main() -> None:
    backend_root = Path(__file__).resolve().parent.parent
    sql_path = backend_root / "prisma" / "init.sql"
    db_path = resolve_database_path()

    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    try:
      with sql_path.open("r", encoding="utf-8") as sql_file:
          sql_script = sql_file.read()

      connection.executescript(sql_script)
      connection.commit()
      print(f"SQLite initialized at {db_path}")
    finally:
      connection.close()


if __name__ == "__main__":
    main()
