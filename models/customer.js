import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    org_id:{
      type: mongoose.Schema.Types.ObjectId, 
      required: true,
      // Using 'ref' helps in populating the organization data if needed
      ref: 'Organization' 
    },
    name: {
      type: String,
      required: false,
      trim: true,
    },

    mobile_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^[0-9]{10}$/, "Invalid mobile number"], 
    },
  },
  {
    timestamps: true,
    collection: "Customers",
  }
);

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
