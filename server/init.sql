-- Create PostGIS extension if not exists
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table (Matches Sequelize User model usually)
CREATE TABLE IF NOT EXISTS "Users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "role" VARCHAR(50) DEFAULT 'user',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Farms table
CREATE TABLE IF NOT EXISTS "Farms" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "location" GEOMETRY(POINT, 4326),
    "userId" UUID REFERENCES "Users"("id"),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- IoT Devices table (Matches IoTDevice model: iot_devices)
CREATE TABLE IF NOT EXISTS "iot_devices" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "deviceId" VARCHAR(100) UNIQUE NOT NULL,
    "farmId" UUID REFERENCES "Farms"("id"),
    "deviceType" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) DEFAULT 'Unnamed Device',
    "status" VARCHAR(50) DEFAULT 'offline',
    "lastSeenAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "type" VARCHAR(50) NOT NULL,
    "priority" VARCHAR(50) DEFAULT 'medium',
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (Password: admin123)
-- Hash generated using bcrypt
INSERT INTO "Users" ("email", "password", "name", "role")
VALUES ('admin@smartagri.com', '$2a$10$X7V.E1g.D.1.X.X.X.X.X.X.X.X.X.X', 'Admin User', 'admin')
ON CONFLICT ("email") DO NOTHING;
