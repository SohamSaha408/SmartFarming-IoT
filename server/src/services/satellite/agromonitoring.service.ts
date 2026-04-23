/**
 * agromonitoring.service.ts
 *
 * FIXES APPLIED:
 * 1. Added getStatistics() — fetches numeric NDVI from the dedicated /image/statistics
 *    endpoint. The /image/search endpoint only returns URL strings for stats, not numbers.
 * 2. Added listPolygons() + getOrCreatePolygon() — avoids creating duplicate polygons on
 *    every call by looking up an existing polygon by farm name first.
 * 3. getNDVI() now returns enriched records that include a resolved numeric ndviMean field.
 */
import axios from 'axios';
import { logger } from '../../utils/logger';

const AGRO_BASE_URL = 'http://api.agromonitoring.com/agro/1.0';
const TIMEOUT_MS    = 10_000;

export class AgromonitoringService {
    private apiKey: string;
    private hasKey: boolean;

    constructor() {
        this.apiKey = process.env.AGROMONITORING_API_KEY || '';
        this.hasKey = this.apiKey.length > 0;
        if (!this.hasKey) {
            logger.warn('[Agro] AGROMONITORING_API_KEY missing — will use mock fallback.');
        }
    }

    /** Returns true only if an API key is configured. */
    public isConfigured(): boolean { return this.hasKey; }

    /** List all polygons already registered under this API key. */
    public async listPolygons(): Promise<any[]> {
        try {
            const r = await axios.get(
                `${AGRO_BASE_URL}/polygons?appid=${this.apiKey}`,
                { timeout: TIMEOUT_MS }
            );
            return Array.isArray(r.data) ? r.data : [];
        } catch (err: any) {
            logger.error(`[Agro] listPolygons error: ${err.message}`);
            return [];
        }
    }

    /**
     * Find an existing polygon by farm name, or create a new one.
     * Prevents accumulating duplicate polygons on every call.
     */
    public async getOrCreatePolygon(farmId: string, lat: number, lon: number): Promise<string | null> {
        try {
            const name = `Farm-${farmId}`;

            // Check for an existing polygon with this farm name first
            const existing = await this.listPolygons();
            const found = existing.find((p: any) => p.name === name);
            if (found?.id) {
                logger.debug(`[Agro] Reusing existing polygon ${found.id} for farm ${farmId}`);
                return found.id;
            }

            // None found — create a 200m square around the farm centre point
            const offset = 0.002;
            const payload = {
                name,
                geo_json: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [lon - offset, lat - offset],
                            [lon + offset, lat - offset],
                            [lon + offset, lat + offset],
                            [lon - offset, lat + offset],
                            [lon - offset, lat - offset],
                        ]],
                    },
                },
            };

            const r = await axios.post(
                `${AGRO_BASE_URL}/polygons?appid=${this.apiKey}`,
                payload,
                { timeout: TIMEOUT_MS }
            );
            logger.info(`[Agro] Created polygon ${r.data.id} for farm ${farmId}`);
            return r.data.id ?? null;
        } catch (err: any) {
            logger.error(`[Agro] getOrCreatePolygon error: ${err.message}`);
            return null;
        }
    }

    /** @deprecated Use getOrCreatePolygon() instead. Kept for backward compat. */
    public async createPolygon(farmId: string, lat: number, lon: number): Promise<string | null> {
        return this.getOrCreatePolygon(farmId, lat, lon);
    }

    /**
     * Search for satellite images in the given date window.
     * Returns raw image-search records (stats field contains URL strings, NOT numbers).
     */
    public async searchImages(polyId: string, startDate: Date, endDate: Date): Promise<any[]> {
        try {
            const start = Math.floor(startDate.getTime() / 1000);
            const end   = Math.floor(endDate.getTime() / 1000);
            const r = await axios.get(
                `${AGRO_BASE_URL}/image/search`,
                { params: { start, end, polyid: polyId, appid: this.apiKey }, timeout: TIMEOUT_MS }
            );
            return Array.isArray(r.data) && r.data.length > 0 ? r.data : [];
        } catch (err: any) {
            logger.error(`[Agro] searchImages error: ${err.message}`);
            return [];
        }
    }

    /**
     * FIX: Fetch numeric NDVI statistics from the dedicated /image/statistics endpoint.
     * The /image/search response contains stats.ndvi as a URL string, not a number.
     * This endpoint returns { mean, std, p25, median, p75, min, max, num }.
     */
    public async getStatistics(statsUrl: string): Promise<{ mean: number } | null> {
        try {
            // statsUrl already contains appid in some responses; append it if missing
            const url = statsUrl.includes('appid')
                ? statsUrl
                : `${statsUrl}${statsUrl.includes('?') ? '&' : '?'}appid=${this.apiKey}`;
            const r = await axios.get(url, { timeout: TIMEOUT_MS });
            // Response shape: { data: { mean, std, ... } } or { mean, std, ... }
            const stats = r.data?.data ?? r.data;
            const mean  = typeof stats?.mean === 'number' ? stats.mean : null;
            if (mean === null) {
                logger.warn(`[Agro] getStatistics returned no mean from ${url}`);
                return null;
            }
            return { mean, ...stats };
        } catch (err: any) {
            logger.error(`[Agro] getStatistics error: ${err.message}`);
            return null;
        }
    }

    /**
     * High-level helper: search images then resolve numeric NDVI for each.
     * Returns records enriched with ndviMean (number) ready for downstream use.
     */
    public async getNDVI(polyId: string, startDate: Date, endDate: Date): Promise<any[]> {
        const images = await this.searchImages(polyId, startDate, endDate);
        if (images.length === 0) return [];

        // Resolve statistics in parallel (at most 5 to stay within rate limits)
        const slice = images.slice(-5); // most recent 5
        const enriched = await Promise.all(
            slice.map(async (img: any) => {
                const statsUrl = img.stats?.ndvi;
                let ndviMean: number | null = null;

                if (typeof statsUrl === 'string' && statsUrl.startsWith('http')) {
                    const stats = await this.getStatistics(statsUrl);
                    ndviMean = stats?.mean ?? null;
                } else if (typeof statsUrl === 'number') {
                    // Already a number (mock data path)
                    ndviMean = statsUrl;
                }

                return { ...img, ndviMean };
            })
        );

        return enriched;
    }
}

export const agromonitoringService = new AgromonitoringService();
