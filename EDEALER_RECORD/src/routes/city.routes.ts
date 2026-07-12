import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createCityHandler,
  listCitiesHandler,
  listCitiesForDropdownByStateHandler,
  getCityByIdHandler,
  updateCityHandler,
  deleteCityHandler,
} from '../controllers/city.controller';
import {
  createCitySchema,
  listCitiesSchema,
  listCitiesForDropdownByStateSchema,
  getCityByIdSchema,
  updateCitySchema,
} from '../validations/city.validation';

const router = Router();

router.use(authenticate);

router.post('/', validate(createCitySchema), asyncHandler(createCityHandler));
router.get('/ddl/:stateId', validate(listCitiesForDropdownByStateSchema), asyncHandler(listCitiesForDropdownByStateHandler));
router.get('/', validate(listCitiesSchema), asyncHandler(listCitiesHandler));
router.get('/:id', validate(getCityByIdSchema), asyncHandler(getCityByIdHandler));
router.patch('/:id', validate(updateCitySchema), asyncHandler(updateCityHandler));
router.delete('/:id', validate(getCityByIdSchema), asyncHandler(deleteCityHandler));

export default router;

