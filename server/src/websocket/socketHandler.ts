/**
 * WebSocket handler — Socket.io
 * Bridges MQTT sensor data → connected browser clients in real-time
 * Rooms: each farmId is a Socket.io room — clients join via 'subscribe:farm'
 */
import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';

let io: SocketServer | null = null;

export const initSocketIO = (httpServer: HttpServer): SocketServer => {
    io = new SocketServer(httpServer, {
        cors: {
            origin: process.env.NODE_ENV === 'production'
                ? process.env.CLIENT_URL
                : ['http://localhost:5173', 'http://127.0.0.1:5173'],
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket: Socket) => {
        logger.info(`[WS] Client connected: ${socket.id}`);

        // Client sends farmId string to subscribe to a farm's live feed
        socket.on('subscribe:farm', (farmId: string) => {
            socket.join(`farm:${farmId}`);
            logger.info(`[WS] ${socket.id} subscribed → farm:${farmId}`);
            socket.emit('subscribed', { farmId });
        });

        socket.on('unsubscribe:farm', (farmId: string) => {
            socket.leave(`farm:${farmId}`);
        });

        socket.on('disconnect', () => {
            logger.info(`[WS] Client disconnected: ${socket.id}`);
        });
    });

    logger.info('[WS] Socket.io server initialised');
    return io;
};

/** Broadcast a new sensor reading to all subscribers of a farm */
export const emitSensorReading = (farmId: string, nodeId: string, data: object) => {
    if (!io) return;
    io.to(`farm:${farmId}`).emit('sensor:reading', {
        farmId, nodeId, data,
        timestamp: new Date().toISOString(),
    });
};

/** Broadcast device online/offline status change */
export const emitDeviceStatus = (farmId: string, deviceId: string, status: string) => {
    if (!io) return;
    io.to(`farm:${farmId}`).emit('device:status', {
        farmId, deviceId, status,
        timestamp: new Date().toISOString(),
    });
};

/** Broadcast a new alert notification + a push:notification event for native device alerts */
export const emitAlert = (farmId: string, alert: object) => {
    if (!io) return;
    // in-app alert channel (existing)
    io.to(`farm:${farmId}`).emit('alert:new', {
        farmId, alert,
        timestamp: new Date().toISOString(),
    });
    // native push channel — client uses this to trigger Web Push / Notification API
    io.to(`farm:${farmId}`).emit('push:notification', {
        farmId, alert,
        timestamp: new Date().toISOString(),
    });
};

/** Broadcast irrigation pump state change */
export const emitIrrigationUpdate = (
    farmId: string,
    deviceId: string,
    state: 'started' | 'stopped'
) => {
    if (!io) return;
    io.to(`farm:${farmId}`).emit('irrigation:update', {
        farmId, deviceId, state,
        timestamp: new Date().toISOString(),
    });
};

export const getIO = (): SocketServer | null => io;
