import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  org_id : { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String },
  type: { type: String, default: 'owner' },
  currentRefreshToken: { type: String, default: null },
}, { 
    timestamps: true,
    collection: 'Users'
});

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
