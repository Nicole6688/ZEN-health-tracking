import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getAICoachResponse = async (userProfile: any, logs: any, userMessage: string) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        text: `You are a professional AI Personal Coach for an app called ZEN. 
        Your goal is to provide encouraging, scientific, and personalized advice based on the user's data.
        
        User Profile: ${JSON.stringify(userProfile)}
        Recent Logs: ${JSON.stringify(logs)}
        
        User Question: ${userMessage}
        
        Please provide a concise, motivating response in English. Focus on nutrition, exercise, and overall wellbeing.`
      }
    ]
  });

  const response = await model;
  return response.text;
};
