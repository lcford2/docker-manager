#!/bin/bash
# Script to update user details in the database
# Usage: ./scripts/update_user.sh <old_username> <new_username>

set -e

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <old_username> <new_username>"
  echo "Example: $0 admin newadmin"
  exit 1
fi

OLD_USERNAME=$1
NEW_USERNAME=$2

echo "Updating username from '$OLD_USERNAME' to '$NEW_USERNAME'"

docker exec -i docker-manager-postgres-1 psql -U docker_manager -d docker_manager <<EOF
UPDATE users
SET username = '$NEW_USERNAME', updated_at = CURRENT_TIMESTAMP
WHERE username = '$OLD_USERNAME';

SELECT username, email, permission FROM users WHERE username = '$NEW_USERNAME';
EOF

echo "Username updated successfully!"
