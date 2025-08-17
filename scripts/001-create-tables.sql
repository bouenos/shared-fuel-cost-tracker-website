-- Create the main app state table
CREATE TABLE IF NOT EXISTS fuel_split_state (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  price_per_km DECIMAL(10,4) NOT NULL DEFAULT 0.5,
  starting_odometer INTEGER NOT NULL DEFAULT 0,
  last_odometer INTEGER,
  amit_km INTEGER NOT NULL DEFAULT 0,
  ori_km INTEGER NOT NULL DEFAULT 0,
  last_entered_by VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the history entries table
CREATE TABLE IF NOT EXISTS fuel_split_entries (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('init', 'entry', 'reset')),
  timestamp BIGINT NOT NULL,
  reading INTEGER,
  delta_km INTEGER,
  attributed_to VARCHAR(10),
  entered_by VARCHAR(10),
  note TEXT,
  snapshot_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial state if table is empty
INSERT INTO fuel_split_state (version, price_per_km, starting_odometer, last_odometer, amit_km, ori_km, last_entered_by)
SELECT 1, 0.5, 0, NULL, 0, 0, NULL
WHERE NOT EXISTS (SELECT 1 FROM fuel_split_state);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fuel_split_entries_timestamp ON fuel_split_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_split_entries_type ON fuel_split_entries(type);
