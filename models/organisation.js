import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const organisationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gst: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String },
  razorpay_key: {
    type: String,
    required: false,
    default: ""
  },
  razorpay_secret: {
    type: String,
    required: false,
    default: ""
  },
  razorpay_webhook_secret: {
    type: String,
    required: false,
    default: ""
  }

}, { 
    timestamps: true,
    collection: 'organisations'
});


const Organisation = mongoose.model('Organisation', organisationSchema);
export default Organisation;
