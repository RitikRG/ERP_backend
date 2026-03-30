import User from "../models/user.js";
import { verifyAccessToken } from "../utils/jwt.js";

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.slice("Bearer ".length).trim();
};

export const requireAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Invalid access token." });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "User account is inactive." });
    }

    req.user = user;
    req.auth = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired access token." });
  }
};

export const requireRole = (allowedRoles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  if (!allowedRoles.includes(req.user.type)) {
    return res.status(403).json({ message: "Forbidden for current user role." });
  }

  next();
};
