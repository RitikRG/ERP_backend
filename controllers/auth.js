import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import Organisation from '../models/organisation.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import config from '../config/config.js';

export const register = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = new User({ email, password, name, phone });
    await user.save();

    const accessToken = signAccessToken({ sub: user._id });
    const refreshToken = signRefreshToken({ sub: user._id });
    user.currentRefreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.cookie('refreshToken', refreshToken, config.COOKIE_OPTIONS);
    res.status(201).json({ user: { id: user._id, email }, accessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
    console.error('Error saving user:', err);
  }
};

export const login = async (req, res) => {
  try {
    console.log('try');
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    const accessToken = signAccessToken({ sub: user._id });
    const refreshToken = signRefreshToken({ sub: user._id });
    user.currentRefreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();

    const org = await Organisation.findById(user.org_id);
    if(!org){
      return res.status(401).json({ message: 'No Linked Organisations found' });
    }

    res.cookie('refreshToken', refreshToken, config.COOKIE_OPTIONS);
    res.json({ user: { id: user._id, email, name: user.name, org_id: user.org_id, org: org }, accessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
