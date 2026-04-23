/**
 * weather.service.ts
 * Fetches forecast data from Open-Meteo (free, no API key needed).
 * Used by automation.service to skip irrigation when rain is coming
 * and to adjust duration based on evapotranspiration (ET₀).
 *
 * Open-Meteo docs: https://open-meteo.com/en/docs
 */
import axios from 'axios';
import { logger } from '../utils/logger';

const BASE_URL = process.env.OPEN_METEO_API_URL || 'https://api.open-meteo.com/v1/forecast';

export interface WeatherForecast {
    rainExpectedNext6h:      boolean;   // true → skip irrigation
    rainExpectedNext24h:     boolean;
    precipitationNext6h:     number;    // mm — total precipitation next 6h
    precipitationNext24h:    number;    // mm — total precipitation next 24h
    et0Next24h:              number;    // mm — reference evapotranspiration
    temperatureNow:          number;    // °C
    humidityNow:             number;    // %
    windspeedNow:            number;    // km/h
    recommendedDurationMins: number;    // scaled irrigation duration
    skipReason:              string | null;
}

/**
 * getForecast
 * @param lat  Farm latitude
 * @param lon  Farm longitude
 * @returns    WeatherForecast object
 */
export const getForecast = async (lat: number, lon: number): Promise<WeatherForecast> => {
    const params = {
        latitude:   lat,
        longitude:  lon,
        hourly:     'precipitation,et0_fao_evapotranspiration,temperature_2m,relativehumidity_2m,windspeed_10m',
        current_weather: true,
        forecast_days: 1,
        timezone:   'auto',
    };

    try {
        const { data } = await axios.get(BASE_URL, { params, timeout: 8000 });
        const hourly   = data.hourly;
        const now      = new Date();
        const nowHour  = now.getHours();

        // Find the index in the hourly array that matches the current hour
        const times: string[] = hourly.time;
        const curIdx = times.findIndex(t => new Date(t).getHours() === nowHour
            && new Date(t).toDateString() === now.toDateString());
        const start = curIdx >= 0 ? curIdx : 0;

        // Sum precipitation for next 6 and 24 hours
        const precip: number[] = hourly.precipitation;
        const et0: number[]    = hourly.et0_fao_evapotranspiration;
        const temp: number[]   = hourly.temperature_2m;
        const hum: number[]    = hourly.relativehumidity_2m;
        const wind: number[]   = hourly.windspeed_10m;

        const sum = (arr: number[], from: number, count: number) =>
            arr.slice(from, from + count).reduce((a, b) => a + (b || 0), 0);

        const precipNext6h  = parseFloat(sum(precip, start, 6).toFixed(2));
        const precipNext24h = parseFloat(sum(precip, start, 24).toFixed(2));
        const et0Next24h    = parseFloat(sum(et0, start, 24).toFixed(2));

        const rainExpectedNext6h  = precipNext6h  > 2;   // > 2 mm in 6h  → skip
        const rainExpectedNext24h = precipNext24h > 5;   // > 5 mm in 24h → note

        // Reduce irrigation duration by the expected ET₀ offset
        // Base 30 min — subtract proportional to expected rain, add for high ET₀
        const baseDuration = 30;
        const rainReduction = Math.min(baseDuration, precipNext24h * 3);
        const et0Addition   = Math.min(15, et0Next24h * 2);
        const recommendedDurationMins = Math.max(
            5,
            Math.round(baseDuration - rainReduction + et0Addition)
        );

        let skipReason: string | null = null;
        if (rainExpectedNext6h) {
            skipReason = `Rain forecast: ${precipNext6h}mm in next 6h`;
        }

        return {
            rainExpectedNext6h,
            rainExpectedNext24h,
            precipitationNext6h:  precipNext6h,
            precipitationNext24h: precipNext24h,
            et0Next24h,
            temperatureNow:  temp[start]  ?? 0,
            humidityNow:     hum[start]   ?? 0,
            windspeedNow:    wind[start]  ?? 0,
            recommendedDurationMins,
            skipReason,
        };
    } catch (err) {
        logger.error('[Weather] Failed to fetch Open-Meteo forecast:', err);
        // Return safe defaults — don't block irrigation if weather fetch fails
        return {
            rainExpectedNext6h:   false,
            rainExpectedNext24h:  false,
            precipitationNext6h:  0,
            precipitationNext24h: 0,
            et0Next24h:           0,
            temperatureNow:       0,
            humidityNow:          0,
            windspeedNow:         0,
            recommendedDurationMins: 30,
            skipReason: null,
        };
    }
};

/** Convenience: cache last result per farm to avoid hammering the API */
const cache = new Map<string, { ts: number; data: WeatherForecast }>();

export const getCachedForecast = async (
    farmId: string,
    lat: number,
    lon: number
): Promise<WeatherForecast> => {
    const cached = cache.get(farmId);
    const ttl = 30 * 60 * 1000; // 30 minutes
    if (cached && Date.now() - cached.ts < ttl) {
        return cached.data;
    }
    const fresh = await getForecast(lat, lon);
    cache.set(farmId, { ts: Date.now(), data: fresh });
    return fresh;
};
