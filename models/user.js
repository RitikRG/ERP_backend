import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  org_id : { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String },
  type: {
    type: String,
    enum: ['owner', 'delivery_agent'],
    default: 'owner',
  },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
}, { 
    timestamps: true,
    collection: 'Users'
});

userSchema.index({ org_id: 1, type: 1, isActive: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
