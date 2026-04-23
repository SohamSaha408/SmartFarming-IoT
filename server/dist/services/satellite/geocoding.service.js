"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineLandType = exports.getLULCStats = exports.geocodeVillage = exports.reverseGeocode = void 0;
const axios_1 = __importDefault(require("axios"));
const BHUVAN_API_BASE = 'https://bhuvan-app1.nrsc.gov.in/api';
// Reverse geocode - get address from coordinates
const reverseGeocode = async (lat, lon) => {
    try {
        const token = process.env.BHUVAN_API_TOKEN;
        if (!token) {
            console.warn('Bhuvan API token not configured, using fallback');
            return {
                village: null,
                district: null,
                state: null,
                pincode: null
            };
        }
        const response = await axios_1.default.get(`${BHUVAN_API_BASE}/village/reverse`, {
            params: { lat, lon },
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = response.data;
        return {
            village: data.village || null,
            district: data.district || null,
            state: data.state || null,
            pincode: data.pincode || null
        };
    }
    catch (error) {
        if (error.response?.status === 402 || error.response?.status === 429) {
            console.warn('Bhuvan API limit reached, using fallback');
        }
        else {
            console.error('Reverse geocoding error:', error.message || error);
        }
        // Fallback: Try OpenStreetMap Nominatim
        try {
            const osmResponse = await axios_1.default.get(`https://nominatim.openstreetmap.org/reverse`, {
                params: {
                    lat,
                    lon,
                    format: 'json',
                    addressdetails: 1
                },
                headers: {
                    'User-Agent': 'SmartAgriIoT/1.0'
                }
            });
            const address = osmResponse.data.address;
            return {
                village: address.village || address.town || address.city || null,
                district: address.county || address.state_district || null,
                state: address.state || null,
                pincode: address.postcode || null
            };
        }
        catch (fallbackError) {
            console.error('Fallback geocoding also failed:', fallbackError);
            return {
                village: null,
                district: null,
                state: null,
                pincode: null
            };
        }
    }
};
exports.reverseGeocode = reverseGeocode;
// Forward geocode - get coordinates from address
const geocodeVillage = async (village, district, state) => {
    try {
        const token = process.env.BHUVAN_API_TOKEN;
        if (!token) {
            // Fallback to OpenStreetMap
            const query = [village, district, state, 'India']
                .filter(Boolean)
                .join(', ');
            const osmResponse = await axios_1.default.get(`https://nominatim.openstreetmap.org/search`, {
                params: {
                    q: query,
                    format: 'json',
                    limit: 1,
                    addressdetails: 1
                },
                headers: {
                    'User-Agent': 'SmartAgriIoT/1.0'
                }
            });
            if (osmResponse.data.length === 0) {
                return null;
            }
            const result = osmResponse.data[0];
            return {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                village: result.address?.village || village,
                district: result.address?.county || district || '',
                state: result.address?.state || state || ''
            };
        }
        const response = await axios_1.default.get(`${BHUVAN_API_BASE}/village/geocode`, {
            params: { village, district },
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
    catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
};
exports.geocodeVillage = geocodeVillage;
// Get LULC (Land Use Land Cover) statistics for an area
const getLULCStats = async (lat, lon, radius = 5000 // meters
) => {
    try {
        const token = process.env.BHUVAN_API_TOKEN;
        if (!token) {
            return null;
        }
        const response = await axios_1.default.get(`${BHUVAN_API_BASE}/lulc/stats`, {
            params: { lat, lon, radius },
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
    catch (error) {
        console.error('LULC stats error:', error);
        return null;
    }
};
exports.getLULCStats = getLULCStats;
// Determine land type from coordinates
const determineLandType = async (lat, lon) => {
    try {
        // In a real implementation, this would use soil data from Bhuvan or SoilGrids API
        // For now, we'll return null and let the user specify
        const lulcData = await (0, exports.getLULCStats)(lat, lon);
        if (!lulcData) {
            return null;
        }
        // Map LULC categories to land types
        const landTypeMapping = {
            'agricultural': 'alluvial',
            'forest': 'forest',
            'barren': 'desert',
            'water': null,
            'built-up': null
        };
        // Return the dominant land type
        return lulcData.dominantType
            ? landTypeMapping[lulcData.dominantType]
            : null;
    }
    catch (error) {
        console.error('Land type determination error:', error);
        return null;
    }
};
exports.determineLandType = determineLandType;
//# sourceMappingURL=geocoding.service.js.map