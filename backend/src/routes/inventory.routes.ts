import { Router } from 'express';
import * as ctrl from '../controllers/inventory.controller';

const router = Router();

router.get('/calendar', ctrl.calendar);
router.get('/availability', ctrl.availability);

export default router;
