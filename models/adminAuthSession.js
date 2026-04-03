import mongoose from 'mongoose';

const adminAuthSessionSchema = new mongoose.Schema(
  {
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true },
    deviceId: { type: String, required: true },
    deviceLabel: { type: String, default: '' },
    hashedRefreshToken: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'AdminAuthSessions',
  }
);

adminAuthSessionSchema.index({ adminUser: 1, deviceId: 1 }, { unique: true });
adminAuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdminAuthSession = mongoose.model('AdminAuthSession', adminAuthSessionSchema);
export default AdminAuthSession;
