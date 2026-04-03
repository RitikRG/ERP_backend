import jwt from 'jsonwebtoken';
import config from '../config/config.js';

export const signAccessToken = (payload) => 
  jwt.sign(payload, config.JWT_ACCESS_SECRET, { expiresIn: config.ACCESS_TOKEN_EXPIRES });

export const signRefreshToken = (payload) => 
  jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: config.REFRESH_TOKEN_EXPIRES });

export const verifyAccessToken = (token) => 
  jwt.verify(token, config.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) => 
  jwt.verify(token, config.JWT_REFRESH_SECRET);

export const signAdminAccessToken = (payload) =>
  jwt.sign(
    { ...payload, scope: 'admin' },
    config.ADMIN_JWT_ACCESS_SECRET,
    { expiresIn: config.ACCESS_TOKEN_EXPIRES }
  );

export const signAdminRefreshToken = (payload) =>
  jwt.sign(
    { ...payload, scope: 'admin' },
    config.ADMIN_JWT_REFRESH_SECRET,
    { expiresIn: config.REFRESH_TOKEN_EXPIRES }
  );

export const verifyAdminAccessToken = (token) => {
  const payload = jwt.verify(token, config.ADMIN_JWT_ACCESS_SECRET);
  if (payload.scope !== 'admin') {
    throw new Error('Invalid admin access token scope');
  }
  return payload;
};

export const verifyAdminRefreshToken = (token) => {
  const payload = jwt.verify(token, config.ADMIN_JWT_REFRESH_SECRET);
  if (payload.scope !== 'admin') {
    throw new Error('Invalid admin refresh token scope');
  }
  return payload;
};
