#!/usr/bin/env bash
# set -euo pipefail

DB_USER="teb"
DB_NAME="checkers"

psql postgres -v ON_ERROR_STOP=1 <<SQL
CREATE USER ${DB_USER} WITH PASSWORD NULL;
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
SQL

psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE auth (
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

CREATE TRIGGER auth_set_updated_at
    BEFORE UPDATE ON auth
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
SQL

## TO RUN THIS SCRIPT, RUN THE FOLLOWING CODE -> chmod +x ./db_init.sh
