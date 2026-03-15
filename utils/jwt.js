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
