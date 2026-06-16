import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL, type GeminiModelId } from "@/lib/gemini-models";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}

export const genAI = new GoogleGenerativeAI(apiKey);

export function getGeminiModel(modelId?: string) {
  const id = GEMINI_MODELS.some((m) => m.id === modelId)
    ? (modelId as GeminiModelId)
    : DEFAULT_GEMINI_MODEL;
  return genAI.getGenerativeModel({ model: id });
}

export const geminiImage = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-image",
});
