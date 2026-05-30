import blogRoutes from './blog.routes';
import { Router } from 'express';
import authRoutes from './auth.routes';
import propertiesRoutes from './properties.routes';
import staffRoutes from './staff.routes';
import bookingsRoutes from './bookings.routes';
import inventoryRoutes from './inventory.routes';
import hostsRoutes from './hosts.routes';
import cmsRoutes from './cms.routes';
import dayOutingRoutes from './dayOuting.routes';
import dashboardRoutes from './dashboard.routes';
import { getSitemap, getRobots } from '../controllers/cms.controller';

const router = Router();

// API Health/Welcome
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Triprodeo API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      properties: '/api/properties',
      staff: '/api/staff',
      bookings: '/api/bookings',
      dashboard: '/api/dashboard',
      dayOuting: '/api/day-outing',
      inventory: '/api/inventory',
      host: '/api/host',
      cms: '/api/cms',
    }
  });
});

router.use('/auth', authRoutes);
router.use('/properties', propertiesRoutes);
router.use('/staff', staffRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/day-outing', dayOutingRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/host', hostsRoutes);
router.use('/cms', cmsRoutes);

// SEO-critical public endpoints
router.get('/sitemap.xml', getSitemap);
router.get('/robots.txt', getRobots);

export default router;
