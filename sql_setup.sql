-- Table to store imported graduate data from the XLSX template
CREATE TABLE IF NOT EXISTS graduates_import (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Academic Year (e.g., "2020-2021")
    academic_year VARCHAR(20),
    
    -- Name Fields
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    
    -- Academic Details
    course TEXT,
    date_graduated DATE,
    
    -- Personal Information
    birthdate DATE,
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- System Fields for Authentication
    password TEXT, -- To be set during import or first login
    is_first_login BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for faster lookups during login/search
CREATE INDEX IF NOT EXISTS idx_graduates_email ON graduates_import(email);
CREATE INDEX IF NOT EXISTS idx_graduates_ay ON graduates_import(academic_year);
