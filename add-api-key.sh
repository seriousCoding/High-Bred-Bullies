#!/bin/bash

# Get the environment variables
API_KEY=$COINBASE_API_KEY
API_SECRET=$COINBASE_API_SECRET

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
  echo "Error: API_KEY or API_SECRET environment variable is not set"
  exit 1
fi

# Create the SQL to insert the API key
SQL="INSERT INTO api_keys (user_id, api_key, api_secret, label, priority, is_active, fail_count) VALUES (2, '$API_KEY', '$API_SECRET', 'Environment API Key', 10, true, 0);"

# Execute the SQL using the DATABASE_URL environment variable
echo "Adding API key to database..."
psql $DATABASE_URL -c "$SQL"

echo "API key added to database!"