import User from "../models/user.js";
import Organization from "../models/organisation.js";
import bcrypt from 'bcryptjs';

// ==========================================================
// USER SETTINGS
// ==========================================================

// GET USER SETTINGS
export const getUserSettings = async (req, res) => {
  try {
    const { org_id } = req.params;

    const user = await User.findOne({ org_id }).select("name phone");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });

  } catch (err) {
    console.error("Get user settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// UPDATE USER SETTINGS
export const updateUserSettings = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { name, phone, password } = req.body;

    let updateData = { name, phone };


    // hash password if present
    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await User.findByIdAndUpdate(user_id, updateData);

    res.json({ message: "User settings updated successfully" });

  } catch (err) {
    console.error("Update user settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ==========================================================
// ORGANISATION SETTINGS
// ==========================================================

// GET ORG SETTINGS
export const getOrgSettings = async (req, res) => {
  try {
    const { org_id } = req.params;

    const org = await Organization.findById(org_id).select(
      "name gst phone address razorpay_key"
    );

    if (!org) return res.status(404).json({ message: "Organisation not found" });

    res.json({ org });

  } catch (err) {
    console.error("Get org settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// UPDATE ORG SETTINGS
export const updateOrgSettings = async (req, res) => {
  try {
    const { org_id } = req.params;
    
    const { name, gst, phone, address, razorpay_key } = req.body;

    const updateData = { name, gst, phone, address, razorpay_key };

    await Organization.findByIdAndUpdate(org_id, updateData);

    res.json({ message: "Organisation settings updated successfully" });

  } catch (err) {
    console.error("Update org settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
