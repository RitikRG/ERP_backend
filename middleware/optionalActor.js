import AdminUser from '../models/adminUser.js';
import User from '../models/user.js';
import { verifyAccessToken, verifyAdminAccessToken } from '../utils/jwt.js';

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }

  return authHeader.slice('Bearer '.length).trim();
};

export const attachOptionalActor = async (req, _res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    next();
    return;
  }

  try {
    const adminPayload = verifyAdminAccessToken(token);
    const admin = await AdminUser.findById(adminPayload.sub).select('-password');

    if (admin && admin.isActive !== false) {
      req.admin = admin;
      req.adminAuth = adminPayload;
      next();
      return;
    }
  } catch {
    // Ignore invalid admin tokens and try user auth next.
  }

  try {
    const userPayload = verifyAccessToken(token);
    const user = await User.findById(userPayload.sub).select('-password');

    if (user && user.isActive !== false) {
      req.user = user;
      req.auth = userPayload;
    }
  } catch {
    // Ignore invalid user tokens.
  }

  next();
};
