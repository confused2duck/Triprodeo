import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const requireInProduction = (key: string, fallback?: string) => {
  const value = process.env[key] || fallback;
  if (process.env.NODE_ENV === 'production' && (!process.env[key] || process.env[key] === fallback)) {
    throw new Error(`${key} must be set explicitly in production`);
  }
  return value;
};

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  DATABASE_URL: process.env.DATABASE_URL!,

  JWT_SECRET: requireInProduction('JWT_SECRET', 'change_in_production')!,
  JWT_REFRESH_SECRET: requireInProduction('JWT_REFRESH_SECRET', 'change_refresh_in_production')!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  ADMIN_DEFAULT_EMAIL: requireInProduction('ADMIN_DEFAULT_EMAIL', 'admin@triprodeo.com')!,
  ADMIN_DEFAULT_PASSWORD: requireInProduction('ADMIN_DEFAULT_PASSWORD', 'triprodeo2025')!,

  CMS_ADMIN_SECRET: requireInProduction('CMS_ADMIN_SECRET', 'cms_secret')!,

  SITE_URL: process.env.SITE_URL || 'https://triprodeo.com',
  SITE_NAME: process.env.SITE_NAME || 'Triprodeo',
  SITE_DESCRIPTION: process.env.SITE_DESCRIPTION || "India's premier luxury villa and resort booking platform",

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_CURRENCY: process.env.RAZORPAY_CURRENCY || 'INR',
};
