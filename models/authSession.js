import mongoose from 'mongoose';

const authSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceId: { type: String, required: true },
  deviceLabel: { type: String, default: '' },
  hashedRefreshToken: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  lastUsedAt: { type: Date, default: Date.now },
}, { 
  timestamps: true,
  collection: 'AuthSessions'
});

authSessionSchema.index({ user: 1, deviceId: 1 });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-cleanup expired sessions

const AuthSession = mongoose.model('AuthSession', authSessionSchema);
export default AuthSession;
