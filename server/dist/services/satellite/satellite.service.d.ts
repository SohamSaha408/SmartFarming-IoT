import { Farm, Crop, CropHealth } from '../../models';
interface Polygon {
    id: string;
    name: string;
    center: [number, number];
    area: number;
}
export declare const createPolygon: (farm: Farm, boundary: any) => Promise<Polygon | null>;
export declare const getPolygon: (polygonId: string) => Promise<Polygon | null>;
export declare const deletePolygon: (polygonId: string) => Promise<boolean>;
export declare const getNDVIData: (polygonId: string, startDate: Date, endDate: Date, lat?: number, lon?: number, farmId?: string) => Promise<any[]>;
export declare const getSatelliteImagery: (polygonId: string, startDate: Date, endDate: Date, lat?: number, lon?: number, farmId?: string) => Promise<any[]>;
export declare const getCurrentWeather: (lat: number, lon: number) => Promise<any>;
export declare const getWeatherForecast: (lat: number, lon: number) => Promise<any>;
export declare const getSoilData: (polygonId: string) => Promise<any>;
export declare const getUVIndex: (lat: number, lon: number) => Promise<any>;
export declare const calculateHealthScore: (ndvi: number) => number;
export declare const getHealthStatus: (score: number) => "excellent" | "healthy" | "moderate" | "stressed" | "critical";
export declare const generateRecommendations: (healthScore: number, ndvi: number, moisture: number | null, temperature: number | null) => string[];
export declare const updateCropHealth: (crop: Crop, polygonId: string) => Promise<CropHealth | null>;
export {};
//# sourceMappingURL=satellite.service.d.ts.map