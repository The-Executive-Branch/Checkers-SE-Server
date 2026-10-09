#!/usr/bin/env bash

## First time only, make the script runnable:  chmod +x ./db_init.sh
## Then run it (port is optional, default 3000):  ./db_init.sh 4000

set -euo pipefail

PORT="${1:-8000}"

if [[ ! "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Port must be a number" >&2
  exit 1
fi

DB_USER="teb"
DB_NAME="${DB_NAME:-checkers}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Create the user if it is missing
user_exists=$(psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'")

if [[ "$user_exists" != "1" ]]; then
psql postgres -v ON_ERROR_STOP=1 <<SQL
CREATE USER ${DB_USER} WITH PASSWORD NULL;
SQL
fi

# Create the database if it is missing
db_exists=$(psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'")

if [[ "$db_exists" != "1" ]]; then
psql postgres -v ON_ERROR_STOP=1 <<SQL
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
SQL
fi

psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER auth_set_updated_at
    BEFORE UPDATE ON auth
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS sessions(
    session_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);
SQL


ENV_FILE="${ENV_FILE:-.env}"
cat > "$ENV_FILE" <<ENV
DATABASE_URL=postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}
PORT=${PORT}
ENV
