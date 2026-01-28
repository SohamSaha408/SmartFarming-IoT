"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Load environment variables
dotenv_1.default.config();
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const farm_routes_1 = __importDefault(require("./routes/farm.routes"));
const crop_routes_1 = __importDefault(require("./routes/crop.routes"));
const irrigation_routes_1 = __importDefault(require("./routes/irrigation.routes"));
const fertilization_routes_1 = __importDefault(require("./routes/fertilization.routes"));
const device_routes_1 = __importDefault(require("./routes/device.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
// Import database
const database_1 = require("./config/database");
// Import MQTT client
const mqtt_1 = require("./config/mqtt");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use((0, morgan_1.default)('dev'));
}
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/farms', farm_routes_1.default);
app.use('/api/crops', crop_routes_1.default);
app.use('/api/irrigation', irrigation_routes_1.default);
app.use('/api/fertilization', fertilization_routes_1.default);
app.use('/api/devices', device_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});
// Initialize database and start server
const startServer = async () => {
    try {
        // Test database connection
        await database_1.sequelize.authenticate();
        console.log('Database connection established successfully.');
        // IMPORTANT:
        // Do NOT auto-run `sync({ alter: true })` in hosted/prod environments.
        // It can generate unsafe/invalid ALTER statements and break startup.
        // If you really want this for local dev, set ENABLE_DB_SYNC=true explicitly.
        if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DB_SYNC === 'true') {
            await database_1.sequelize.sync({ alter: true });
            console.log('Database models synchronized (alter).');
        }
        // Initialize MQTT client
        try {
            (0, mqtt_1.initMQTT)();
        }
        catch (err) {
            console.error('MQTT init error (continuing without MQTT):', err);
        }
        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map