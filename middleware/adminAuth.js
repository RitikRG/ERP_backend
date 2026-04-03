import AdminUser from '../models/adminUser.js';
import { verifyAdminAccessToken } from '../utils/jwt.js';

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }

  return authHeader.slice('Bearer '.length).trim();
};

export const requireAdminAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({ message: 'Admin authentication required.' });
    }

    const payload = verifyAdminAccessToken(token);
    const admin = await AdminUser.findById(payload.sub).select('-password');

    if (!admin || admin.isActive === false) {
      return res.status(401).json({ message: 'Invalid admin access token.' });
    }

    req.admin = admin;
    req.adminAuth = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired admin access token.' });
  }
};
