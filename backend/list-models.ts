import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("No API key");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    const models = data.models.map((m: any) => m.name);
    console.log(models);
}
run();
