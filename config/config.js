import dotenv from 'dotenv';
dotenv.config();

export default {
  PORT: process.env.PORT || 4000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRES: '15m',
  REFRESH_TOKEN_EXPIRES: '7d',
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }
};
