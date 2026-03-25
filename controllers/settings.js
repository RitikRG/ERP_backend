import User from "../models/user.js";
import Organization from "../models/organisation.js";
import ShopSOP from "../models/shopSOP.js";
import bcrypt from "bcryptjs";

const buildOrgSettingsResponse = (org) => ({
  _id: org._id,
  name: org.name,
  gst: org.gst,
  phone: org.phone,
  address: org.address,
  razorpay_key: org.razorpay_key || "",
  has_razorpay_secret: Boolean(org.razorpay_secret),
  has_razorpay_webhook_secret: Boolean(org.razorpay_webhook_secret),
});

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
      "name gst phone address razorpay_key razorpay_secret razorpay_webhook_secret"
    );

    if (!org)
      return res.status(404).json({ message: "Organisation not found" });

    res.json({ org: buildOrgSettingsResponse(org) });
  } catch (err) {
    console.error("Get org settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE ORG SETTINGS
export const updateOrgSettings = async (req, res) => {
  try {
    const { org_id } = req.params;

    const {
      name,
      gst,
      phone,
      address,
      razorpay_key,
      razorpay_secret,
      razorpay_webhook_secret,
    } = req.body;

    const updateData = { name, gst, phone, address, razorpay_key };

    if (typeof razorpay_secret === "string" && razorpay_secret.trim() !== "") {
      updateData.razorpay_secret = razorpay_secret.trim();
    }

    if (
      typeof razorpay_webhook_secret === "string" &&
      razorpay_webhook_secret.trim() !== ""
    ) {
      updateData.razorpay_webhook_secret = razorpay_webhook_secret.trim();
    }

    const updatedOrg = await Organization.findByIdAndUpdate(
      org_id,
      updateData,
      {
        new: true,
      }
    ).select(
      "name gst phone address razorpay_key razorpay_secret razorpay_webhook_secret"
    );

    res.json({
      message: "Organisation settings updated successfully",
      org: updatedOrg ? buildOrgSettingsResponse(updatedOrg) : null,
    });
  } catch (err) {
    console.error("Update org settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================================================
// SHOP SOP SETTINGS
// ==========================================================

const buildSopPayload = (data = {}) => ({
  delivery: {
    enabled: data.delivery?.enabled ?? true,
    minimumOrder: Number(data.delivery?.minimumOrder ?? 150),
    hoursStart: data.delivery?.hoursStart || "09:00",
    hoursEnd: data.delivery?.hoursEnd || "21:00",
    days: data.delivery?.days || "Monday to Saturday",
  },
  payment: {
    cod: data.payment?.cod ?? true,
    upi: data.payment?.upi ?? true,
  },
  shop: {
    openTime: data.shop?.openTime || "09:00",
    closeTime: data.shop?.closeTime || "21:00",
    weeklyOff: data.shop?.weeklyOff || "Sunday",
    contact: data.shop?.contact || "",
  },
  rules: {
    allowSubstitutions: data.rules?.allowSubstitutions ?? true,
    partialOrders: data.rules?.partialOrders ?? true,
    maxItems:
      data.rules?.maxItems === "" || data.rules?.maxItems === undefined
        ? null
        : Number(data.rules.maxItems),
    specialInstructions: data.rules?.specialInstructions || "",
  },
});

export const getSopSettings = async (req, res) => {
  try {
    const { org_id } = req.params;

    let sop = await ShopSOP.findOne({ shopId: org_id }).lean();

    if (!sop) {
      sop = await ShopSOP.create({ shopId: org_id });
      sop = sop.toObject();
    }

    res.json({ sop: buildSopPayload(sop) });
  } catch (err) {
    console.error("Get SOP settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateSopSettings = async (req, res) => {
  try {
    const { org_id } = req.params;
    const payload = buildSopPayload(req.body);

    const sop = await ShopSOP.findOneAndUpdate(
      { shopId: org_id },
      {
        $set: {
          shopId: org_id,
          ...payload,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    res.json({
      message: "SOP settings updated successfully",
      sop: buildSopPayload(sop),
    });
  } catch (err) {
    console.error("Update SOP settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
