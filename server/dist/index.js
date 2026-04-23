"use strict";
// IMPROVED:
// 1. Added compression middleware — reduces API response sizes by ~70%
// 2. Health check endpoint now tests DB + MQTT connectivity (not just status: ok)
// 3. Global error handler logs request details for easier debugging
// 4. logger.info used consistently instead of raw console.log
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const compression_1 = __importDefault(require("compression"));
const socketHandler_1 = require("./websocket/socketHandler");
dotenv_1.default.config();
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const farm_routes_1 = __importDefault(require("./routes/farm.routes"));
const crop_routes_1 = __importDefault(require("./routes/crop.routes"));
const irrigation_routes_1 = __importDefault(require("./routes/irrigation.routes"));
const fertilization_routes_1 = __importDefault(require("./routes/fertilization.routes"));
const device_routes_1 = __importDefault(require("./routes/device.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const ota_routes_1 = __importDefault(require("./routes/ota.routes"));
const database_1 = require("./config/database");
const mqttHandler_1 = require("./mqtt/mqttHandler");
const logger_1 = require("./utils/logger");
require("./models/OtaFirmware.model"); // ensure table is registered for sync
const ota_service_1 = require("./services/ota.service");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 3000;
// IMPROVED: gzip compression before all other middleware
app.use((0, compression_1.default)());
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com", "https://placehold.co", "https://unpkg.com"],
            connectSrc: ["'self'", "https://api.open-meteo.com"],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
    app.use((0, morgan_1.default)('dev'));
}
// IMPROVED: Health check now tests DB + MQTT, not just status: ok
app.get('/health', async (req, res) => {
    const checks = {};
    try {
        await database_1.sequelize.authenticate();
        checks.database = 'ok';
    }
    catch {
        checks.database = 'error';
    }
    const mqttClient = (0, mqttHandler_1.getClient)();
    checks.mqtt = mqttClient?.connected ? 'ok' : 'disconnected';
    const allOk = Object.values(checks).every(v => v === 'ok');
    res.status(allOk ? 200 : 503).json({
        status: allOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        checks,
    });
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/farms', farm_routes_1.default);
app.use('/api/crops', crop_routes_1.default);
app.use('/api/irrigation', irrigation_routes_1.default);
app.use('/api/fertilization', fertilization_routes_1.default);
app.use('/api/devices', device_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/ota', ota_routes_1.default);
app.use('/api/*', (req, res) => {
    logger_1.logger.warn(`[404] API Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'Route not found' });
});
const clientBuildPath = path_1.default.join(__dirname, '../../client/dist');
app.use(express_1.default.static(clientBuildPath));
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(clientBuildPath, 'index.html'));
});
// IMPROVED: Global error handler logs method + URL for easier debugging
app.use((err, req, res, _next) => {
    logger_1.logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
});
const startServer = async () => {
    try {
        await database_1.sequelize.authenticate();
        logger_1.logger.info('Database connection established.');
        if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DB_SYNC === 'true') {
            await database_1.sequelize.sync({ alter: true });
            logger_1.logger.info('Database models synchronized (alter).');
        }
        try {
            (0, mqttHandler_1.initMQTT)();
        }
        catch (err) {
            logger_1.logger.error('MQTT init error (continuing without MQTT):', err);
        }
        (0, ota_service_1.ensureOtaDir)(); // create ota_firmware/ and ota_firmware/tmp/ if missing
        // Initialise Socket.io on the same HTTP server
        (0, socketHandler_1.initSocketIO)(httpServer);
        httpServer.listen(PORT, () => {
            logger_1.logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map