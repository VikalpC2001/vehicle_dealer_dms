import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { analyzeIdProofHandler, analyzeImageHandler } from '../controllers/ai.controller';
import { uploadSingleImage } from '../middlewares/upload.middleware';

const router = Router();

router.post('/analyze-image', uploadSingleImage, asyncHandler(analyzeImageHandler));
router.post('/analyze-id-proof', uploadSingleImage, asyncHandler(analyzeIdProofHandler));

export default router;
