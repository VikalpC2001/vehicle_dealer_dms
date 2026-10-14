import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import type { IdProofDetails } from '../types/ai.types';
import { AppError } from '../utils/app-error';

/**
 * AI extraction: the image is sent DIRECTLY to Gemini vision → structured JSON, in a single call.
 * Vision reads the actual glyphs, so it resolves look-alikes (0 vs O, 1 vs I) far better than
 * OCR-to-text. "Thinking" is disabled for cost + latency (it is billed as output and adds seconds);
 * models that reject the thinking flag are transparently retried without it. The Gemini call is timed
 * and the duration is returned so the client can display it.
 */

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const modelName = config.GEMINI_MODEL;

/** Base strict-JSON generation config — compact, deterministic output. */
const BASE_JSON_CONFIG: GenerationConfig = {
  responseMimeType: 'application/json',
  maxOutputTokens: 2048,
  temperature: 0,
};

/**
 * The generation config used for every call — always ONE request. Non-lite Gemini models "think" by
 * default (billed as output, adds seconds), so we disable it with `thinkingBudget: 0`. Lite models
 * don't think AND reject that flag (400), so we omit it for them. Resolved once from the model name.
 */
const GENERATION_CONFIG: GenerationConfig = modelName.toLowerCase().includes('lite')
  ? BASE_JSON_CONFIG
  : ({ ...BASE_JSON_CONFIG, thinkingConfig: { thinkingBudget: 0 } } as GenerationConfig);

/**
 * Builds a concise, user-safe AppError from Gemini SDK/runtime errors.
 *
 * @param error - Unknown error thrown by Gemini SDK.
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

  return new AppError(`Failed to analyze image using Gemini: ${rawMessage}`, StatusCodes.BAD_GATEWAY, 5020);
};

const aiImagePrompt = `You are reading a photo of an Indian vehicle Registration Certificate (RC). Extract the fields and return ONLY JSON of EXACTLY this shape:
{"vehicleInfo":{"vehicleNo":null,"chassisNo":null,"engineNo":null,"registrationDate":null,"manufactureMonth":null,"manufactureYear":null,"vehicleType":null,"make":null,"model":null},"ownerInfo":{"fullName":null,"address":null,"city":null,"state":null,"pincode":null}}
Rules:
- Read values exactly as printed; if a value is not visible or uncertain, use null. Do not invent.
- manufactureMonth (1-12) and manufactureYear (4-digit) come from the MANUFACTURING date (labels: "Mfg Dt/Date", "Mth & Yr of Mfg", "MFG"), usually MM/YYYY — NOT the registration date.
- ownerInfo.fullName: one space-separated string (given name, then father's/husband's name if shown after "S/W/D of", then surname).
- Merge a multi-line owner address into one comma-separated string; keep city, state, and pincode ONLY in their own keys (address excludes them).
- vehicleNo, chassisNo, engineNo: resolve look-alike characters by format — Indian plates are 2 letters, 1-2 digits, 1-3 letters, then 4 digits (e.g. GJ03DL8888); use 0-vs-O and 1-vs-I by position. Output vehicleNo uppercase with no spaces.`;

const idProofPrompt = `You are reading a photo of an Indian identity document (Aadhaar, PAN, Driving Licence, Voter ID, or Passport). Return ONLY JSON of EXACTLY this shape:
{"fullName":null,"address":null,"city":null,"state":null,"pincode":null}
Rules:
- Copy text exactly as printed; null if not visible or uncertain (do not invent).
- fullName: one space-separated string (given name, father's/husband's name if shown, surname).
- Merge a multi-line address into one comma-separated string; address is street/locality/area only (exclude city/state/pincode).
- city: locality/city/district. state: 2-letter code if shown (e.g. GJ, MH). pincode: 6 digits.
- If only a side without an address is shown (e.g. PAN front), set address/city/state/pincode to null.`;

/**
 * Removes optional markdown wrappers and extracts the likely JSON object text.
 *
 * @param value - Raw model output text.
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
  if (value === null || value === undefined || typeof value !== 'string') {
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
 * Lossless cleanup of the extracted RC ID fields (uppercase + strip separators). The prompt's format
 * hint handles O/0 disambiguation; this only normalizes spacing/case for consistency.
 */
const normalizeRcIds = (parsed: Record<string, unknown>): Record<string, unknown> => {
  const info = parsed.vehicleInfo;
  if (info && typeof info === 'object' && !Array.isArray(info)) {
    const v = info as Record<string, unknown>;
    if (typeof v.vehicleNo === 'string') v.vehicleNo = v.vehicleNo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (typeof v.chassisNo === 'string') v.chassisNo = v.chassisNo.toUpperCase().replace(/\s+/g, '');
    if (typeof v.engineNo === 'string') v.engineNo = v.engineNo.toUpperCase().replace(/\s+/g, '');
  }
  return parsed;
};

/** Sleeps for the given milliseconds (retry backoff). */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** True for TRANSIENT Gemini errors worth retrying (503 overloaded / 429 rate-limited). */
const isTransientGeminiError = (error: unknown): boolean => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes('quota exceeded')) {
    return false;
  }
  return (
    message.includes('[503') ||
    message.includes('[429') ||
    message.includes('unavailable') ||
    message.includes('overloaded') ||
    message.includes('high demand') ||
    message.includes('try again later') ||
    message.includes('too many requests')
  );
};

const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_BASE_DELAY_MS = 500;

type GeminiPart = { text: string } | { inlineData: { data: string; mimeType: string } };

/**
 * Sends content parts to Gemini with the given generation config and returns parsed JSON. Retries
 * transient upstream errors (503/429) with exponential backoff + jitter; a parse error or a
 * non-transient error fails immediately.
 */
const generateJson = async (
  parts: GeminiPart[],
  generationConfig: GenerationConfig,
): Promise<Record<string, unknown>> => {
  if (!config.GEMINI_API_KEY) {
    throw new AppError('GEMINI_API_KEY is not configured', StatusCodes.INTERNAL_SERVER_ERROR, 5002);
  }

  const model = genAI.getGenerativeModel({ model: modelName });
  let lastError: unknown;
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await model.generateContent({ contents: [{ role: 'user', parts }], generationConfig });
      return parseGeminiJson(result.response.text());
    } catch (error) {
      if (error instanceof AppError) {
        throw error; // our own parse failure — deterministic, do not retry/re-wrap
      }
      lastError = error;
      if (!isTransientGeminiError(error) || attempt === GEMINI_MAX_ATTEMPTS) {
        break;
      }
      await sleep(GEMINI_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 200));
    }
  }
  throw mapGeminiError(lastError);
};

/**
 * Runs a Gemini VISION prompt against an image and returns parsed JSON — a single request, thinking
 * disabled (see {@link GENERATION_CONFIG}).
 *
 * @param prompt - Extraction instructions.
 * @param fileBuffer - Uploaded image bytes.
 * @param mimeType - Uploaded image MIME type.
 */
const runGeminiVisionJson = (
  prompt: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<Record<string, unknown>> =>
  generateJson(
    [{ text: prompt }, { inlineData: { data: fileBuffer.toString('base64'), mimeType } }],
    GENERATION_CONFIG,
  );

/**
 * RC extraction: image → Gemini vision → `{ vehicleInfo, ownerInfo }` JSON.
 *
 * @param fileBuffer - Uploaded image bytes.
 * @param mimeType - Uploaded image MIME type.
 */
export const analyzeImageWithGemini = async (
  fileBuffer: Buffer,
  mimeType: string,
): Promise<Record<string, unknown>> => {
  const parsed = await runGeminiVisionJson(aiImagePrompt, fileBuffer, mimeType);
  return normalizeRcIds(parsed);
};

/**
 * ID-proof extraction: image → Gemini vision → identity/address fields.
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
