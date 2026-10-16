# Checkers-SE-Server

Express server for the checkers application. The entry file is `index.ts`.

## Prerequisites

- Node.js
- PostgreSQL installed and running. See the [official downloads page](https://www.postgresql.org/download/), or on macOS with Homebrew:

  ```bash
  brew install postgresql
  brew services start postgresql
  ```

### Platform notes

`db_init.sh` assumes a Homebrew install on macOS, where the database admin account is your own login name.

- Linux: change `psql postgres` to `sudo -u postgres psql` in the first step of the script.
- Windows: use Windows Subsystem for Linux, install PostgreSQL inside it, and follow the Linux instructions. See the [install guide](https://learn.microsoft.com/windows/wsl/install).

## Database setup

The following commands need to be run in your bash shell on windows devices before running `./db_init.sh`.

```bash
  sudo -u postgres createuser -s "$USER"
  sudo -u postgres createdb "$USER"
```

Find the hba_file path and open the code

```bash
  sudo -u postgres psql -c "SHOW hba_file;"
  sudo nano <that path>
```

Scroll to find the code block below and change their values to `trust`.

```bash
  local   all   all                 trust
  host    all   all   127.0.0.1/32  trust
  host    all   all   ::1/128       trust
```

Reload postgresql

```bash
  sudo systemctl reload postgresql
```

Find your current role and ensure it is a superuser

```bash
  #will return a role name
  whoami
  #a table will appear, if superuser is next to your role, you can skip this step, if not, continue
  psql -d postgres -c '\du'
  #replace X with your role
  sudo -u postgres psql -c "ALTER ROLE X WITH SUPERUSER;"
  #verify your role is a superuser
  psql -d postgres -c '\du'
```

The `db_init.sh` script creates the database user, the database, and the tables, then writes a `.env` file containing the connection string and the server port.

Run these commands from the project root:

```bash
chmod +x ./db_init.sh
./db_init.sh
```

The `chmod` command only needs to be run once. It gives the script permission to execute.

### Choosing a port

The script accepts an optional port number for the server. If you leave it off, the port defaults to `3000`.

```bash
./db_init.sh 8080
```

### What the script creates

| Item             | Name                                  |
| ---------------- | ------------------------------------- |
| Database user    | `teb`                                 |
| Database         | `checkers`                            |
| Table            | `auth`                                |
| Environment file | `.env` with `DATABASE_URL` and `PORT` |

### CORS_ORIGINS

The origins allowed to call the server from a browser, as a comma-separated list.

- Development: `http://localhost:5173` (the Vite development server). This is also the default when the variable is not set.
- Tests: set the same value in `.env.test`.

If the app shows "blocked by CORS policy" in its console, check that this list
contains the app's origin exactly. Run `location.origin` in the app's console
to see it. `localhost` and `127.0.0.1` count as different origins.



### Running it again

The script is meant for first-time setup and will fail if the user or database already exists. To start over, remove them first:

```bash
psql postgres -c 'DROP DATABASE checkers;'
psql postgres -c 'DROP USER teb;'
```

This permanently deletes all data in the database.

To change only the port later, edit the `PORT` line in `.env` directly.

## Running the server

```bash
npm install
npm start
```

## Running integration tests

1. Create the test database (first time only):
   `DB_NAME=checkers_test ENV_FILE=.env.test ./db_init.sh`
2. Run the tests:
   `npm test`
