#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-checkers}"
PORT="${PORT:-3000}"
BASE_URL="http://localhost:$PORT"
TEST_PASSWORD="test-password-123"
SESSION_ID="test-session-$(date +%s)"

# Hash the password with the same library the server uses
hash=$(node -e "console.log(require('bcrypt').hashSync(process.argv[1], 10))" "$TEST_PASSWORD")

psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
-- Remove leftovers from earlier runs
DELETE FROM auth WHERE username IN ('testuser', 'newuser');

-- 1. Create the test user
INSERT INTO auth (username, email, password_hash)
VALUES ('testuser', 'testuser@example.com', '$hash');

-- 2. Create a session for that user
INSERT INTO sessions (session_id, user_id)
VALUES (
  '$SESSION_ID',
  (SELECT id FROM auth WHERE username = 'testuser')
);

-- 3. Create a second session for the same user
INSERT INTO sessions (session_id, user_id)
VALUES (
  '$SESSION_ID-second',
  (SELECT id FROM auth WHERE username = 'testuser')
);
SQL

echo
echo "Test user created. Try:"
echo
echo "# Register (creates a separate user named newuser)"
echo "curl -i -X POST $BASE_URL/auth/register \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\":\"newuser\",\"email\":\"newuser@example.com\",\"password\":\"$TEST_PASSWORD\",\"passwordConfirmation\":\"$TEST_PASSWORD\"}'"
echo
echo "# Login (as testuser)"
echo "curl -i -X POST $BASE_URL/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\":\"testuser\",\"password\":\"$TEST_PASSWORD\"}'"
echo
echo "# Logout (ends the first session)"
echo "curl -i -X POST $BASE_URL/auth/logout \\"
echo "  -H 'Authorization: Bearer $SESSION_ID'"
echo
echo "# Unregister (uses the second session, deletes testuser)"
echo "curl -i -X POST $BASE_URL/auth/unregister \\"
echo "  -H 'Authorization: Bearer $SESSION_ID-second' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"passwordConfirmation\":\"$TEST_PASSWORD\"}'"
