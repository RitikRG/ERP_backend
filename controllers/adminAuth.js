import bcrypt from 'bcryptjs';
import AdminUser from '../models/adminUser.js';
import AdminAuthSession from '../models/adminAuthSession.js';
import config from '../config/config.js';
import {
  signAdminAccessToken,
  signAdminRefreshToken,
  verifyAdminRefreshToken,
} from '../utils/jwt.js';

const ADMIN_REFRESH_COOKIE = 'adminRefreshToken';

const sanitizeAdmin = (admin) => ({
  id: admin._id,
  _id: admin._id,
  email: admin.email,
  name: admin.name,
  isActive: admin.isActive !== false,
  lastLoginAt: admin.lastLoginAt || null,
  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt,
});

export const setAdminRefreshSession = async (res, admin, deviceId, deviceLabel = '') => {
  const accessToken = signAdminAccessToken({ sub: admin._id, deviceId });
  const refreshToken = signAdminRefreshToken({ sub: admin._id, deviceId });
  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await AdminAuthSession.findOneAndUpdate(
    { adminUser: admin._id, deviceId },
    {
      hashedRefreshToken,
      isActive: true,
      deviceLabel,
      expiresAt,
      lastUsedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  res.cookie(ADMIN_REFRESH_COOKIE, refreshToken, config.ADMIN_COOKIE_OPTIONS);
  return accessToken;
};

export const loginAdmin = async (req, res) => {
  try {
    const { email, password, deviceId, deviceLabel } = req.body;

    if (!email || !password || !deviceId) {
      return res.status(400).json({ message: 'Email, password, and deviceId are required.' });
    }

    const admin = await AdminUser.findOne({ email: String(email).toLowerCase() });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }

    if (admin.isActive === false) {
      return res.status(403).json({ message: 'Admin account is inactive.' });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const accessToken = await setAdminRefreshSession(res, admin, deviceId, deviceLabel);

    return res.status(200).json({
      admin: sanitizeAdmin(admin),
      accessToken,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Admin login failed.' });
  }
};

export const refreshAdmin = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[ADMIN_REFRESH_COOKIE];
    if (!refreshToken) {
      return res.status(401).json({ message: 'Admin refresh token missing.' });
    }

    const payload = verifyAdminRefreshToken(refreshToken);
    const admin = await AdminUser.findById(payload.sub);

    if (!admin || admin.isActive === false) {
      return res.status(403).json({ message: 'Admin account is inactive or not found.' });
    }

    const session = await AdminAuthSession.findOne({
      adminUser: admin._id,
      deviceId: payload.deviceId,
    });

    if (!session || !session.isActive) {
      return res.status(401).json({ message: 'Invalid or expired admin session.' });
    }

    const isValidToken = await bcrypt.compare(refreshToken, session.hashedRefreshToken);
    if (!isValidToken) {
      return res.status(401).json({ message: 'Invalid admin refresh token.' });
    }

    const accessToken = await setAdminRefreshSession(
      res,
      admin,
      payload.deviceId,
      session.deviceLabel
    );

    return res.status(200).json({ accessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired admin refresh token.' });
  }
};

export const logoutAdmin = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[ADMIN_REFRESH_COOKIE];

    if (refreshToken) {
      try {
        const payload = verifyAdminRefreshToken(refreshToken);
        await AdminAuthSession.findOneAndUpdate(
          { adminUser: payload.sub, deviceId: payload.deviceId },
          { isActive: false, hashedRefreshToken: '' }
        );
      } catch {
        // Clear cookie even if already invalid.
      }
    }

    res.clearCookie(ADMIN_REFRESH_COOKIE, config.ADMIN_COOKIE_OPTIONS);
    return res.status(200).json({ message: 'Admin logged out successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Admin logout failed.' });
  }
};
