import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import Organisation from '../models/organisation.js';
import AuthSession from '../models/authSession.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import config from '../config/config.js';

const sanitizeOrganisation = (org) => {
  if (!org) return null;

  return {
    _id: org._id,
    name: org.name,
    gst: org.gst,
    address: org.address,
    phone: org.phone,
    razorpay_key: org.razorpay_key || "",
    has_razorpay_secret: Boolean(org.razorpay_secret),
    has_razorpay_webhook_secret: Boolean(org.razorpay_webhook_secret),
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
};

const sanitizeUser = (user, org = null) => ({
  id: user._id,
  _id: user._id,
  email: user.email,
  name: user.name,
  phone: user.phone || "",
  org_id: user.org_id,
  type: user.type,
  isActive: user.isActive !== false,
  lastLoginAt: user.lastLoginAt || null,
  org: sanitizeOrganisation(org),
});

export const setRefreshSession = async (res, user, deviceId, deviceLabel = '') => {
  const accessToken = signAccessToken({ sub: user._id, role: user.type, deviceId });
  const refreshToken = signRefreshToken({ sub: user._id, role: user.type, deviceId });
  
  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await AuthSession.findOneAndUpdate(
    { user: user._id, deviceId },
    { 
      hashedRefreshToken, 
      isActive: true, 
      deviceLabel, 
      expiresAt, 
      lastUsedAt: new Date() 
    },
    { upsert: true, new: true }
  );

  res.cookie('refreshToken', refreshToken, config.COOKIE_OPTIONS);
  return accessToken;
};

export const register = async (req, res) => {
  try {
    const { email, password, name, phone, org_id, deviceId, deviceLabel } = req.body;
    if (!email || !password || !org_id) {
      return res.status(400).json({ message: 'Email, password, and organisation are required' });
    }
    if (!deviceId) return res.status(400).json({ message: 'deviceId is required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const organisation = await Organisation.findById(org_id);
    if (!organisation) {
      return res.status(404).json({ message: 'Linked organisation not found' });
    }

    const user = new User({ org_id, email, password, name, phone, type: 'owner' });
    await user.save();

    const accessToken = await setRefreshSession(res, user, deviceId, deviceLabel);
    res.status(201).json({ user: sanitizeUser(user, organisation), accessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
    console.error('Error saving user:', err);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, deviceId, deviceLabel } = req.body;
    if (!deviceId) return res.status(400).json({ message: 'deviceId is required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    if (user.isActive === false) {
      return res.status(403).json({ message: 'User account is inactive' });
    }

    const org = await Organisation.findById(user.org_id);
    if(!org){
      return res.status(401).json({ message: 'No Linked Organisations found' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = await setRefreshSession(res, user, deviceId, deviceLabel);

    res.json({
      user: sanitizeUser(user, org),
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token missing' });

    const payload = verifyRefreshToken(refreshToken);
    if (!payload.deviceId) return res.status(401).json({ message: 'Invalid refresh token payload' });

    const user = await User.findById(payload.sub);
    if (!user || user.isActive === false) return res.status(403).json({ message: 'User account is inactive or not found' });

    const session = await AuthSession.findOne({ user: user._id, deviceId: payload.deviceId });
    if (!session || !session.isActive) return res.status(401).json({ message: 'Invalid or expired session' });

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, session.hashedRefreshToken);
    if (!isRefreshTokenValid) return res.status(401).json({ message: 'Invalid refresh token' });

    const accessToken = await setRefreshSession(res, user, payload.deviceId, session.deviceLabel);
    return res.status(200).json({ accessToken });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        if (payload.deviceId) {
          await AuthSession.findOneAndUpdate(
            { user: payload.sub, deviceId: payload.deviceId },
            { isActive: false, hashedRefreshToken: '' }
          );
        }
      } catch (error) {
        // Clear cookie even if token is already invalid.
      }
    }

    res.clearCookie('refreshToken', config.COOKIE_OPTIONS);
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
