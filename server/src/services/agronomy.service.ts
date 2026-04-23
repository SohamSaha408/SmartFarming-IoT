import { logger } from '../utils/logger';

/**
 * Calculates Vapor Pressure Deficit (VPD) in kPa.
 * VPD measures the difference between the amount of moisture in the air
 * and how much moisture the air can hold when it is saturated.
 * 
 * @param temperature Air temperature in Celsius
 * @param humidity Relative humidity percentage
 * @returns Object containing VPD value and status
 */
export const calculateVPD = (temperature: number, humidity: number): { value: number; status: 'Low' | 'Optimal' | 'High' } => {
    try {
        if (temperature == null || humidity == null) return { value: 0, status: 'Optimal' };

        // Saturation Vapor Pressure (SVP) in kPa (Tetens formula)
        const svp = 0.61078 * Math.exp((17.27 * temperature) / (temperature + 237.3));
        
        // Actual Vapor Pressure (AVP) in kPa
        const avp = svp * (humidity / 100);
        
        // Vapor Pressure Deficit
        let vpd = svp - avp;
        vpd = Math.max(0, parseFloat(vpd.toFixed(3)));

        // Determine status (general greenhouse guidelines)
        // Optimal is typically 0.4 - 1.2 kPa depending on crop stage
        let status: 'Low' | 'Optimal' | 'High' = 'Optimal';
        if (vpd < 0.4) {
            status = 'Low'; // Risk of fungal disease, plant can't transpire
        } else if (vpd > 1.2) {
            status = 'High'; // Plant stress, stomata closing
        }

        return { value: vpd, status };
    } catch (e) {
        logger.error('Error calculating VPD', e);
        return { value: 0, status: 'Optimal' };
    }
};

/**
 * Estimates Evapotranspiration (ET) proxy in mm/day.
 * A simplified empirical model based on temperature, humidity, and light.
 * 
 * @param temperature Air temperature in Celsius
 * @param humidity Relative humidity percentage
 * @param lightIntensity Light intensity in lux
 * @returns Estimated ET in mm/day
 */
export const calculateET = (temperature: number, humidity: number, lightIntensity: number = 0): number => {
    try {
        if (temperature == null || humidity == null) return 0;
        
        // Very basic empirical proxy for demonstration.
        // Higher temp = higher ET. Higher humidity = lower ET. Higher light = higher ET.
        // Assuming 10000 lux is roughly 100 W/m2 of solar radiation proxy for this simple model
        let et = (temperature * 0.25) - (humidity * 0.05) + ((lightIntensity / 10000) * 0.8);
        
        return Math.max(0, parseFloat(et.toFixed(2)));
    } catch (e) {
        logger.error('Error calculating ET', e);
        return 0;
    }
};

/**
 * Calculates a Fungal Disease Risk Index based on recent environmental conditions.
 * Fungi thrive in high humidity and moderate-to-warm temperatures.
 * 
 * @param temperature Average recent temperature
 * @param humidity Average recent humidity
 * @returns Risk score (0-100) and severity label
 */
export const calculateDiseaseRisk = (temperature: number, humidity: number): { score: number; level: 'Low' | 'Moderate' | 'High' } => {
    try {
        if (temperature == null || humidity == null) return { score: 0, level: 'Low' };

        let score = 0;

        // Fungi love humidity > 85%
        if (humidity > 85) {
            score += 60;
        } else if (humidity > 75) {
            score += 30;
        }

        // Fungi love moderate temps (15C - 25C)
        if (temperature >= 15 && temperature <= 25) {
            score += 40;
        } else if (temperature > 25 && temperature <= 30) {
            score += 20; // Some risk, but getting too hot for many fungi
        }

        score = Math.min(100, score);

        let level: 'Low' | 'Moderate' | 'High' = 'Low';
        if (score >= 80) level = 'High';
        else if (score >= 50) level = 'Moderate';

        return { score, level };
    } catch (e) {
        logger.error('Error calculating Disease Risk', e);
        return { score: 0, level: 'Low' };
    }
};

/**
 * Calculates Growing Degree Days (GDD) for a single day.
 * GDD tracks heat accumulation used to predict plant and animal development rates.
 * 
 * @param averageTemp Daily average temperature
 * @param baseTemp Base temperature for the specific crop (usually 10C)
 * @returns Accumulated heat units for the day
 */
export const calculateGDD = (averageTemp: number, baseTemp: number = 10): number => {
    try {
        if (averageTemp == null) return 0;
        
        // GDD = T_avg - T_base. If negative, it's 0.
        const gdd = averageTemp - baseTemp;
        return Math.max(0, parseFloat(gdd.toFixed(1)));
    } catch (e) {
        logger.error('Error calculating GDD', e);
        return 0;
    }
};

/**
 * Calculates Estimated Yield Potential based on NDVI.
 * Assumes an NDVI of 0.85 is near 100% potential for most crops.
 * 
 * @param ndvi Normalized Difference Vegetation Index
 * @returns Yield potential percentage
 */
export const calculateYieldPotential = (ndvi: number): number => {
    try {
        if (ndvi == null || ndvi < 0) return 0;
        
        // Cap NDVI at 0.85 for 100% 
        let potential = (ndvi / 0.85) * 100;
        return Math.min(100, Math.max(0, parseFloat(potential.toFixed(1))));
    } catch (e) {
        logger.error('Error calculating Yield Potential', e);
        return 0;
    }
};

/**
 * Calculates additional Nitrogen (N) Top-dress requirement based on NDVI.
 * A precision agriculture standard to estimate how much fertilizer is needed
 * for underperforming zones.
 * 
 * @param ndvi Normalized Difference Vegetation Index
 * @returns Estimated fertilizer requirement in kg/ha
 */
export const calculateNitrogenRequirement = (ndvi: number): number => {
    try {
        if (ndvi == null || ndvi < 0) return 0;

        // If NDVI is above 0.75, crop is generally healthy and needs minimal extra N.
        // If NDVI is lower, we linearly scale up the N requirement (up to ~120kg/ha).
        if (ndvi >= 0.75) return 0;

        let nRequirement = (0.75 - ndvi) * 160; 
        return Math.max(0, parseFloat(nRequirement.toFixed(1)));
    } catch (e) {
        logger.error('Error calculating N Requirement', e);
        return 0;
    }
};
