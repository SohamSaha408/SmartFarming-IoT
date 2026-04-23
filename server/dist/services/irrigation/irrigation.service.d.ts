import { Farm, Crop, CropHealth, SensorReading, IrrigationSchedule } from '../../models';
interface IrrigationRecommendation {
    cropId: string;
    cropType: string;
    recommendedDuration: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    weatherForecast: string;
}
export declare const calculateIrrigationNeed: (crop: Crop, farm: Farm, latestHealth: CropHealth | null, sensorData: SensorReading | null) => Promise<IrrigationRecommendation | null>;
export declare const getIrrigationRecommendations: (farmId: string, farmerId: string) => Promise<IrrigationRecommendation[]>;
export declare const createIrrigationSchedule: (farmId: string, cropId: string | null, deviceId: string | null, scheduledTime: Date, durationMinutes: number, triggeredBy: "manual" | "auto" | "schedule" | "sensor") => Promise<IrrigationSchedule>;
export declare const triggerIrrigation: (scheduleId: string) => Promise<boolean>;
export declare const stopIrrigation: (farmId: string) => Promise<boolean>;
export declare const updateIrrigationStatus: (scheduleId: string, status: "completed" | "failed", actualVolume?: number) => Promise<void>;
export {};
//# sourceMappingURL=irrigation.service.d.ts.map