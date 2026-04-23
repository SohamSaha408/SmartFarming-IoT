/**
 * useSocket — manages a Socket.io connection and farm subscription
 *
 * Enhancements:
 * - Listens for push:notification → triggers native browser/device Notification API
 * - Requests notification permission on first alert (works on mobile PWA too)
 * - Vibrates device on critical alerts (mobile navigator.vibrate)
 * - Exposes alertHistory[] so any component can render an alert feed
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : 'http://localhost:3000';

export interface SensorReading {
    farmId: string;
    nodeId: string;
    data: {
        moisture?: number;
        soilMoisture?: number;
        temperature?: number;
        humidity?: number;
        lux?: number;
        ph?: number;
        [key: string]: any;
    };
    timestamp: string;
}

export interface DeviceStatus {
    deviceId: string;
    status: string;
    timestamp: string;
}

export interface AlertEvent {
    farmId: string;
    alert: {
        type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        title: string;
        message: string;
        sensor?: Record<string, number>;
    };
    timestamp: string;
}

export interface IrrigationUpdate {
    deviceId: string;
    state: 'started' | 'stopped';
    timestamp: string;
}

// ── Web Push helper ──────────────────────────────────────────────────────────
const SEVERITY_ICON: Record<string, string> = {
    critical: '🚨',
    high:     '⚠️',
    medium:   'ℹ️',
    low:      '✅',
};

async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
}

function firePushNotification(alert: AlertEvent['alert']) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const icon = SEVERITY_ICON[alert.severity] ?? 'ℹ️';
    const n = new Notification(`${icon} ${alert.title}`, {
        body: alert.message,
        icon: '/pwa-192x192.png',   // your PWA icon
        badge: '/pwa-192x192.png',
        tag: alert.type,            // collapses duplicate same-type alerts
        requireInteraction: alert.severity === 'critical',
    });
    // Auto-close non-critical after 8 s
    if (alert.severity !== 'critical') setTimeout(() => n.close(), 8000);
    // Vibrate mobile on critical (pattern: 500ms on, 200ms off × 3)
    if (alert.severity === 'critical' && 'vibrate' in navigator) {
        navigator.vibrate([500, 200, 500, 200, 500]);
    }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useSocket(farmId: string | null) {
    const socketRef                               = useRef<Socket | null>(null);
    const [isConnected, setIsConnected]           = useState(false);
    const [latestReading, setLatestReading]       = useState<SensorReading | null>(null);
    const [deviceStatuses, setDeviceStatuses]     = useState<Record<string, string>>({});
    const [latestAlert, setLatestAlert]           = useState<AlertEvent | null>(null);
    const [alertHistory, setAlertHistory]         = useState<AlertEvent[]>([]);
    const [irrigationUpdate, setIrrigationUpdate] = useState<IrrigationUpdate | null>(null);
    const [readings, setReadings]                 = useState<SensorReading[]>([]);
    const [notifPermission, setNotifPermission]   = useState<NotificationPermission>('default');

    const subscribe = useCallback((socket: Socket, fId: string) => {
        socket.emit('subscribe:farm', fId);
    }, []);

    // Ask for native notification permission once on mount
    useEffect(() => {
        requestNotificationPermission().then(granted => {
            setNotifPermission(granted ? 'granted' : Notification.permission);
        });
    }, []);

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            withCredentials: true,
            autoConnect: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            if (farmId) subscribe(socket, farmId);
        });

        socket.on('disconnect', () => setIsConnected(false));

        socket.on('sensor:reading', (event: SensorReading) => {
            setLatestReading(event);
            setReadings(prev => [...prev.slice(-59), event]);
        });

        socket.on('device:status', (event: DeviceStatus) => {
            setDeviceStatuses(prev => ({ ...prev, [event.deviceId]: event.status }));
        });

        socket.on('alert:new', (event: AlertEvent) => {
            setLatestAlert(event);
            setAlertHistory(prev => [event, ...prev.slice(0, 49)]); // keep last 50
        });

        // ── Native device notification on push:notification event ────────────
        socket.on('push:notification', async (event: AlertEvent) => {
            setLatestAlert(event);
            setAlertHistory(prev => [event, ...prev.slice(0, 49)]);
            // Ensure permission before firing (user may have just granted it)
            const granted = await requestNotificationPermission();
            setNotifPermission(granted ? 'granted' : Notification.permission);
            if (granted) firePushNotification(event.alert);
        });

        socket.on('irrigation:update', (event: IrrigationUpdate) => {
            setIrrigationUpdate(event);
        });

        return () => { socket.disconnect(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (socketRef.current?.connected && farmId) {
            subscribe(socketRef.current, farmId);
        }
    }, [farmId, subscribe]);

    return {
        isConnected,
        latestReading,
        readings,
        deviceStatuses,
        latestAlert,
        alertHistory,
        irrigationUpdate,
        notifPermission,
        socket: socketRef.current,
    };
}
