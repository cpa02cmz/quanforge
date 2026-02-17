// AI Import Manager - Ultra-granular imports for better bundle splitting
import { createScopedLogger } from "../../utils/logger";

const logger = () => createScopedLogger('ai-imports');

// Granular import functions for better code splitting
export async function importGoogleGenAI() {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    return GoogleGenAI;
  } catch (error: unknown) {
    logger().error('Failed to import GoogleGenAI:', error);
    throw new Error('AI service unavailable');
  }
}

export async function importAIGenerationTypes() {
  try {
    const { Type } = await import("@google/genai");
    return Type;
  } catch (error: unknown) {
    logger().error('Failed to import AI types:', error);
    throw new Error('AI types unavailable');
  }
}

export async function importAIModels() {
  try {
    const genai = await import("@google/genai");
    return genai; // Return the module for model access
  } catch (error: unknown) {
    logger().error('Failed to import AI models:', error);
    throw new Error('AI models unavailable');
  }
}

// Future extension for other AI providers
export async function importDeepSeekClient() {
  try {
    // Placeholder for DeepSeek integration
    // const { DeepSeek } = await import("deepseek-api");
    // return DeepSeek;
    throw new Error('DeepSeek not implemented yet');
  } catch (error: unknown) {
    logger().error('Failed to import DeepSeek:', error);
    throw new Error('DeepSeek service unavailable');
  }
}

export async function importOpenAIClient() {
  try {
    // Placeholder for OpenAI integration
    // const { OpenAI } = await import("openai");
    // return OpenAI;
    throw new Error('OpenAI not implemented yet');
  } catch (error: unknown) {
    logger().error('Failed to import OpenAI:', error);
    throw new Error('OpenAI service unavailable');
  }
}