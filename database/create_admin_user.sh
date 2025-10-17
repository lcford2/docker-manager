#!/bin/bash
set -e

# Hash the admin password using PostgreSQL's crypt function
# This script creates the initial admin user using environment variables

PGPASSWORD=$POSTGRES_PASSWORD psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Insert admin user with hashed password
    INSERT INTO users (username, email, password_hash, permission, is_active)
    VALUES (
        '${ADMIN_USERNAME}',
        '${ADMIN_EMAIL}',
        crypt('${ADMIN_PASSWORD}', gen_salt('bf')),
        'admin',
        true
    )
    ON CONFLICT (username) DO NOTHING;

    -- Log that admin user was created
    DO \$\$
    BEGIN
        IF EXISTS (SELECT 1 FROM users WHERE username = '${ADMIN_USERNAME}') THEN
            RAISE NOTICE 'Admin user created successfully: %', '${ADMIN_USERNAME}';
        END IF;
    END \$\$;
EOSQL
