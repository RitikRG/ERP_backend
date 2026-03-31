import User from "../models/user.js";
import AuthSession from "../models/authSession.js";

const sanitizeDeliveryAgent = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  phone: user.phone || "",
  type: user.type,
  isActive: user.isActive !== false,
  lastLoginAt: user.lastLoginAt || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getDeliveryAgents = async (req, res) => {
  try {
    const agents = await User.find({
      org_id: req.user.org_id,
      type: "delivery_agent",
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      agents: agents.map(sanitizeDeliveryAgent),
    });
  } catch (error) {
    console.error("Error fetching delivery agents:", error);
    return res.status(500).json({ message: "Failed to fetch delivery agents." });
  }
};

export const createDeliveryAgent = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        message: "Name, email, and password are required.",
      });
    }

    const existingUser = await User.findOne({ email: String(email).toLowerCase() });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered." });
    }

    const agent = new User({
      org_id: req.user.org_id,
      email,
      password,
      name,
      phone,
      type: "delivery_agent",
      isActive: true,
    });

    await agent.save();

    return res.status(201).json({
      message: "Delivery agent created successfully.",
      agent: sanitizeDeliveryAgent(agent),
    });
  } catch (error) {
    console.error("Error creating delivery agent:", error);
    return res.status(500).json({ message: "Failed to create delivery agent." });
  }
};

export const updateDeliveryAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { name, phone, password, isActive } = req.body;

    const agent = await User.findOne({
      _id: agentId,
      org_id: req.user.org_id,
      type: "delivery_agent",
    });

    if (!agent) {
      return res.status(404).json({ message: "Delivery agent not found." });
    }

    if (typeof name === "string" && name.trim()) {
      agent.name = name.trim();
    }

    if (typeof phone === "string") {
      agent.phone = phone.trim();
    }

    if (typeof isActive === "boolean") {
      agent.isActive = isActive;
      if (!isActive) {
        await AuthSession.updateMany({ user: agent._id }, { isActive: false, hashedRefreshToken: '' });
      }
    }

    if (typeof password === "string" && password.trim()) {
      agent.password = password.trim();
    }

    await agent.save();

    return res.status(200).json({
      message: "Delivery agent updated successfully.",
      agent: sanitizeDeliveryAgent(agent),
    });
  } catch (error) {
    console.error("Error updating delivery agent:", error);
    return res.status(500).json({ message: "Failed to update delivery agent." });
  }
};
