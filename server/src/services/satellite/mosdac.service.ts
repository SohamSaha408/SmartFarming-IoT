import axios from 'axios';

const MOSDAC_BASE_URL = process.env.MOSDAC_API_URL || 'https://www.mosdac.gov.in/live/api';

interface MosdacAuthResponse {
    token: string;
    expiresIn: number;
}

export class MosdacService {
    private token: string | null = null;
    private tokenExpiry: number = 0;

    /**
     * Authenticate with MOSDAC to get an access token.
     * Note: The actual endpoint /auth/login is a placeholder. 
     * You may need to check the specific documentation for the login path.
     */
    private async authenticate(): Promise<string> {
        if (this.token && Date.now() < this.tokenExpiry) {
            return this.token;
        }

        try {
            const username = process.env.MOSDAC_USERNAME;
            const password = process.env.MOSDAC_PASSWORD;

            if (!username || !password) {
                throw new Error('MOSDAC credentials not configured');
            }

            console.log('Authenticating with MOSDAC...');

            // REAL CALL 
            const response = await axios.post<MosdacAuthResponse>(`${MOSDAC_BASE_URL}/auth/login`, {
              username,
              password
            });
            this.token = response.data.token;
            this.tokenExpiry = Date.now() + (response.data.expiresIn * 1000);
            return this.token;

        } catch (error: any) {
            console.error('MOSDAC Authentication failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Fetch NDVI map (WMS or specialized endpoint)
     */
    public async getNDVIMap(lat: number, lon: number): Promise<string> {
        try {
            const token = await this.authenticate();

            console.log(`Fetching MOSDAC NDVI for ${lat}, ${lon}`);

            const productCode = '3DIMG_L1B_STD'; // Example product code

            // REAL CALL
            const response = await axios.get(`${MOSDAC_BASE_URL}/products/${productCode}`, {
              params: { lat, lon, date: new Date().toISOString().split('T')[0] },
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data && response.data.url) {
                return response.data.url;
            }

            // Return a standard placeholder or the real WMS endpoint if known
            return `https://www.mosdac.gov.in/wms/ndvi?bbox=${lat - 0.1},${lon - 0.1},${lat + 0.1},${lon + 0.1}`;

        } catch (error: any) {
            console.error('Failed to fetch MOSDAC NDVI:', error.response?.data || error.message);
            return '';
        }
    }

    /**
     * Fetch Weather Forecast specific to Indian region
     */
    public async getWeatherForecast(lat: number, lon: number): Promise<any> {
        const token = await this.authenticate();
        // Implementation would go here
        return null;
    }
}

export const mosdacService = new MosdacService();
