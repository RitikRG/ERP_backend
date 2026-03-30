import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import Organisation from '../models/organisation.js';
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

const setRefreshSession = async (res, user) => {
  const accessToken = signAccessToken({ sub: user._id, role: user.type });
  const refreshToken = signRefreshToken({ sub: user._id, role: user.type });
  user.currentRefreshToken = await bcrypt.hash(refreshToken, 10);
  await user.save();
  res.cookie('refreshToken', refreshToken, config.COOKIE_OPTIONS);

  return accessToken;
};

export const register = async (req, res) => {
  try {
    const { email, password, name, phone, org_id } = req.body;
    if (!email || !password || !org_id) {
      return res.status(400).json({ message: 'Email, password, and organisation are required' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const organisation = await Organisation.findById(org_id);
    if (!organisation) {
      return res.status(404).json({ message: 'Linked organisation not found' });
    }

    const user = new User({ org_id, email, password, name, phone, type: 'owner' });
    await user.save();

    const accessToken = await setRefreshSession(res, user);
    res.status(201).json({ user: sanitizeUser(user, organisation), accessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
    console.error('Error saving user:', err);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
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
    const accessToken = await setRefreshSession(res, user);

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

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing' });
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);

    if (!user || !user.currentRefreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'User account is inactive' });
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.currentRefreshToken
    );

    if (!isRefreshTokenValid) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const accessToken = await setRefreshSession(res, user);
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
        const user = await User.findById(payload.sub);
        if (user) {
          user.currentRefreshToken = null;
          await user.save();
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
