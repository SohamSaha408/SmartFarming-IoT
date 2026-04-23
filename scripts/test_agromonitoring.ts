import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

async function testAgro() {
    const apiKey = process.env.AGROMONITORING_API_KEY;
    console.log("=== Testing Agromonitoring API ===");
    console.log("Using API Key:", apiKey ? "FOUND" : "NOT FOUND");

    try {
        // Step 1: Create a polygon to get an ID
        console.log("Creating polygon...");
        const polyData = {
            name: "Test Farm Polygon",
            geo_json: {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Polygon",
                    coordinates: [
                        [
                            [78.9620, 20.5930],
                            [78.9630, 20.5930],
                            [78.9630, 20.5940],
                            [78.9620, 20.5940],
                            [78.9620, 20.5930]
                        ]
                    ]
                }
            }
        };

        const polyRes = await axios.post(`http://api.agromonitoring.com/agro/1.0/polygons?appid=${apiKey}`, polyData);
        const polyId = polyRes.data.id;
        console.log("Created Polygon ID:", polyId);

        // Step 2: Search for satellite imagery
        const start = Math.floor(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime() / 1000);
        const end = Math.floor(Date.now() / 1000);
        console.log(`Searching images between ${start} and ${end}...`);

        const imageRes = await axios.get(`http://api.agromonitoring.com/agro/1.0/image/search?start=${start}&end=${end}&polyid=${polyId}&appid=${apiKey}`);
        
        console.log("Found images:", imageRes.data.length);
        if (imageRes.data.length > 0) {
            console.log("Latest Image Data:");
            console.log("- NDVI Tile:", imageRes.data[0].image.ndvi);
            console.log("- True Color:", imageRes.data[0].image.truecolor);
            console.log("- Stats:", imageRes.data[0].stats.ndvi);
        }

        console.log("SUCCESS");
    } catch (e: any) {
        console.error("FAILED:", e.response?.data || e.message);
    }
}

testAgro();
