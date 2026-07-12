import { GoogleGenerativeAI } from '@google/generative-ai';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import type { IdProofDetails } from '../types/ai.types';
import { AppError } from '../utils/app-error';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const modelName = config.GEMINI_MODEL;

/**
 * Builds a concise, user-safe AppError from Gemini SDK/runtime errors.
 *
 * @param error - Unknown error thrown by Gemini SDK.
 * @returns Normalized AppError instance.
 */
const mapGeminiError = (error: unknown): AppError => {
  const rawMessage = error instanceof Error ? error.message : 'Unknown error';
  const messageLower = rawMessage.toLowerCase();

  if (
    rawMessage.includes('[429') ||
    messageLower.includes('too many requests') ||
    messageLower.includes('quota exceeded')
  ) {
    const retryMatch =
      rawMessage.match(/retry in\s+([\d.]+)s/i) ?? rawMessage.match(/"retryDelay":"(\d+)s"/i);
    const retryHint = retryMatch?.[1] ? ` Retry after ~${retryMatch[1]}s.` : '';
    return new AppError(
      `Gemini quota exceeded or rate limited.${retryHint} Check billing/quota and try again.`,
      StatusCodes.TOO_MANY_REQUESTS,
      4290,
    );
  }

  return new AppError(
    `Failed to analyze image using Gemini: ${rawMessage}`,
    StatusCodes.BAD_GATEWAY,
    5020,
  );
};

const aiImagePrompt = `Analyze this vehicle image and extract details.
Return ONLY valid JSON (no markdown, no explanation, no code fences).
Use EXACTLY this shape:
{
  "vehicleInfo": {
    "vehicleNo": "string | null",
    "chassisNo": "string | null",
    "engineNo": "string | null",
    "registrationDate": "string | null",
    "manufactureMonth": "number | null",
    "manufactureYear": "number | null",
    "vehicleType": "string | null",
    "make": "string | null",
    "model": "string | null"
  },
  "ownerInfo": {
    "fullName": "string | null",
    "address": "string | null",
    "city": "string | null",
    "state": "string | null",
    "pincode": "string | null"
  }
}
Rules:
- If a value is not visible or uncertain, set it to null.
- Keep values exactly as seen in the image (do not invent or normalize).
- manufactureMonth and manufactureYear: read the vehicle's MANUFACTURING date (often labeled "Mfg Dt", "Mfg Date", "Month/Yr of Mfg", "Month & Year of Manufacture", or "MFG"), usually formatted MM/YYYY. Set manufactureMonth to the month number (1-12) and manufactureYear to the 4-digit year. If the manufacturing date is not visible, set both to null. Do NOT use the registration date for these.
- ownerInfo.fullName: output one string with all name parts in order, space-separated. For individual owners, the document may label a parent line as "Son/Wife/Daughter of" (or similar). Use the owner's given name first, then the name shown after that header (father/parent name) if present, then surname — e.g. "Vikalp Dipakkumar Chavda". Do not split into separate fields; copy spelling from the image.
- If owner address spans multiple lines, merge into a single string with commas.
- In ownerInfo, keep city, state, and pincode ONLY in their own keys.
- ownerInfo.address must exclude city, state, and pincode text.`;

const idProofPrompt = `Analyze this Indian identity document image (Aadhaar, PAN, Driving Licence, Voter ID, Passport, or similar).
Return ONLY valid JSON (no markdown, no explanation, no code fences).
Use EXACTLY this shape:
{
  "fullName": "string | null",
  "address": "string | null",
  "city": "string | null",
  "state": "string | null",
  "pincode": "string | null"
}
Rules:
- If a value is not visible or uncertain, set it to null.
- Copy text exactly as printed on the document (spelling, casing).
- fullName: one space-separated string with all name parts in order (given name, father's/husband's name if shown, surname).
- If address spans multiple lines, merge into a single string with commas.
- address: street/locality/area only; do NOT include city, state, or pincode in address.
- city: locality/city/district as printed.
- state: use 2-letter state code when shown (e.g. GJ, MH); otherwise use the code implied by the document or null.
- pincode: 6-digit PIN only, digits only.
- If the image shows only one side without address (e.g. PAN front), set address/city/state/pincode to null.`;

/**
 * Removes optional markdown wrappers and extracts the likely JSON object text.
 *
 * @param value - Raw model output text.
 * @returns Sanitized JSON candidate string.
 */
const sanitizeJsonText = (value: string): string => {
  const withoutFences = value
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = withoutFences.indexOf('{');
  const lastBrace = withoutFences.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFences.slice(firstBrace, lastBrace + 1);
  }

  return withoutFences;
};

/**
 * Parses Gemini output into a JSON object and fails safely when invalid.
 *
 * @param output - Raw model output text.
 * @returns Parsed JSON object.
 */
const parseGeminiJson = (output: string): Record<string, unknown> => {
  const candidate = sanitizeJsonText(output);

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new AppError('AI returned invalid JSON response', StatusCodes.BAD_GATEWAY, 5021);
  }
};

/**
 * Coerces a parsed JSON field to a trimmed string or null.
 *
 * @param value - Raw field from model output.
 */
const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Maps Gemini output to the ID proof response shape.
 *
 * @param parsed - Parsed JSON object from the model.
 */
const parseIdProofDetails = (parsed: Record<string, unknown>): IdProofDetails => ({
  fullName: toNullableString(parsed.fullName),
  address: toNullableString(parsed.address),
  city: toNullableString(parsed.city),
  state: toNullableString(parsed.state),
  pincode: toNullableString(parsed.pincode),
});

/**
 * Runs a Gemini vision prompt against an image buffer and returns parsed JSON.
 *
 * @param prompt - System-style extraction instructions.
 * @param fileBuffer - Uploaded image bytes.
 * @param mimeType - Uploaded image MIME type.
 */
const runGeminiVisionJson = async (
  prompt: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<Record<string, unknown>> => {
  if (!config.GEMINI_API_KEY) {
    throw new AppError('GEMINI_API_KEY is not configured', StatusCodes.INTERNAL_SERVER_ERROR, 5002);
  }

  const inlineData = {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType,
    },
  };

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent([{ text: prompt }, inlineData]);
    const modelText = result.response.text();
    return parseGeminiJson(modelText);
  } catch (error) {
    throw mapGeminiError(error);
  }
};

/**
 * Analyzes an image using Gemini and returns structured JSON text extraction.
 *
 * @param fileBuffer - Uploaded image bytes.
 * @param mimeType - Uploaded image MIME type.
 * @returns Structured JSON object from model output.
 */
export const analyzeImageWithGemini = async (
  fileBuffer: Buffer,
  mimeType: string,
): Promise<Record<string, unknown>> => {
  return runGeminiVisionJson(aiImagePrompt, fileBuffer, mimeType);
};

/**
 * Extracts identity and address fields from an Indian ID proof image via Gemini.
 *
 * @param fileBuffer - Uploaded image bytes.
 * @param mimeType - Uploaded image MIME type.
 */
export const analyzeIdProofWithGemini = async (
  fileBuffer: Buffer,
  mimeType: string,
): Promise<IdProofDetails> => {
  const parsed = await runGeminiVisionJson(idProofPrompt, fileBuffer, mimeType);
  return parseIdProofDetails(parsed);
};
