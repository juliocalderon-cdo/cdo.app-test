import { GoogleGenAI } from "@google/genai";
import { Article } from '../types';

export const analyzeImportData = async (articles: Article[], fileName: string): Promise<string> => {
  // The API key MUST be obtained exclusively from the environment variable.
  const API_KEY = 'AIzaSyCwigLEFiRDipikxLncbVnvq2Sk7lD0wHA';

  if (!API_KEY) {
    console.warn("API_KEY environment variable not set. Gemini features will be disabled.");
    return "Gemini analysis is disabled. API key not configured.";
  }
  
  // Initialize the AI instance only when it's actually needed and the key exists.
  // This prevents the app from crashing on start if the key is not set.
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `
    Analyze the following list of articles from an import file named "${fileName}".
    Provide a concise summary for a warehouse manager.
    The summary should include:
    1. The total number of articles and total quantity of units.
    2. A list of each "madre" (parent item) and the count of unique SKUs associated with it.
    3. Point out any potential issues, such as articles with a missing "madre" field.

    Here is the article data in JSON format:
    ${JSON.stringify(articles, null, 2)}

    Format your response as a simple text summary.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text ?? 'El análisis no pudo ser generado.';
  } catch (error) {
    console.error("Error analyzing import data with Gemini:", error);
    return "Could not analyze data. An error occurred while contacting the AI service.";
  }
};