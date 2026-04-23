import { IoTDevice, SensorReading } from '../../models';
export declare const storeSensorReading: (deviceId: string, data: {
    soilMoisture?: number;
    soilTemperature?: number;
    soilPh?: number;
    nitrogenLevel?: number;
    phosphorusLevel?: number;
    potassiumLevel?: number;
    airTemperature?: number;
    airHumidity?: number;
    lightIntensity?: number;
    windSpeed?: number;
}) => Promise<SensorReading | null>;
export declare const updateDeviceStatus: (deviceId: string, status: "active" | "inactive" | "maintenance" | "offline") => Promise<boolean>;
export declare const registerDevice: (farmId: string, deviceId: string, deviceType: "soil_sensor" | "water_pump" | "valve" | "weather_station" | "npk_sensor", name?: string, latitude?: number, longitude?: number) => Promise<IoTDevice | null>;
export declare const getLatestReadings: (deviceId: string, limit?: number) => Promise<SensorReading[]>;
export declare const getDeviceStats: (deviceId: string, hours?: number) => Promise<{
    avgSoilMoisture: null;
    avgTemperature: null;
    readingCount: number;
    lastReading: null;
    minSoilMoisture?: undefined;
    maxSoilMoisture?: undefined;
    minTemperature?: undefined;
    maxTemperature?: undefined;
} | {
    avgSoilMoisture: number | null;
    minSoilMoisture: number | null;
    maxSoilMoisture: number | null;
    avgTemperature: number | null;
    minTemperature: number | null;
    maxTemperature: number | null;
    readingCount: number;
    lastReading: Date;
}>;
//# sourceMappingURL=iot.service.d.ts.map