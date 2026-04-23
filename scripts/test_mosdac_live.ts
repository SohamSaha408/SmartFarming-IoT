import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the backend environment variables
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

import { mosdacService } from '../server/src/services/satellite/mosdac.service.ts';

async function testMosdacLive() {
    console.log("=== Testing MOSDAC LIVE API ===");
    console.log("Using username:", process.env.MOSDAC_USERNAME);
    
    try {
        console.log("\nAttempting to fetch NDVI data (which triggers auth)...");
        // Coordinates for Mumbai, India
        const lat = 19.0760;
        const lon = 72.8777;
        
        await mosdacService.getNDVIMap(lat, lon);
        console.log("\nDone checking.");
    } catch (error) {
        console.error("\nTEST FAILED.");
    }
}

testMosdacLive();
