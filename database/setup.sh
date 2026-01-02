#!/bin/bash
# BloxGrid Database Setup Script

echo "Creating BloxGrid database..."

# Connect to postgres and create database
psql -U drewstorey -d postgres -c "CREATE DATABASE bloxgrid;"

# Run schema
echo "Running schema migrations..."
psql -U drewstorey -d bloxgrid -f schema.sql

echo "Database setup complete!"
echo "Admin login: admin@bloxgrid.local"
echo "Default password: admin123"
echo "⚠️  CHANGE THIS IMMEDIATELY IN PRODUCTION"
