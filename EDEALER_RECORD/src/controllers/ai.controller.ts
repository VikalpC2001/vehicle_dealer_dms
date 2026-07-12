import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { analyzeIdProofWithGemini, analyzeImageWithGemini } from '../services/ai.service';
import { AppError } from '../utils/app-error';

/**
 * POST /ai/analyze-image
 * Uploads a single image file and returns Gemini structured analysis.
 */
export const analyzeImageHandler = async (req: Request, res: Response): Promise<void> => {
  const file = req.file;

  if (!file) {
    throw new AppError('Image file is required (field: image)', StatusCodes.BAD_REQUEST, 4002);
  }

  const data = await analyzeImageWithGemini(file.buffer, file.mimetype);

  res.status(StatusCodes.OK).json({
    success: true,
    data,
  });
};

/**
 * POST /ai/analyze-id-proof
 * Uploads a single ID proof image and returns extracted identity/address JSON.
 */
export const analyzeIdProofHandler = async (req: Request, res: Response): Promise<void> => {
  const file = req.file;

  if (!file) {
    throw new AppError('Image file is required (field: image)', StatusCodes.BAD_REQUEST, 4002);
  }

  const data = await analyzeIdProofWithGemini(file.buffer, file.mimetype);

  res.status(StatusCodes.OK).json({
    success: true,
    data,
  });
};
