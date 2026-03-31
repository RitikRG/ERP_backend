import PushSubscription from '../models/pushSubscription.js';
import NotificationDelivery from '../models/notificationDelivery.js';
import NotificationEvent from '../models/notificationEvent.js';

export const registerSubscription = async (req, res) => {
  try {
    const { deviceId, subscription, userAgent } = req.body;

    if (!deviceId || !subscription) {
      return res.status(400).json({ message: 'deviceId and subscription are required' });
    }

    const payload = {
      user: req.user._id,
      orgId: req.user.org_id,
      role: req.user.type,
      deviceId,
      subscription,
      userAgent: userAgent || req.headers['user-agent'] || '',
      isActive: true,
      lastSeenAt: new Date()
    };

    const sub = await PushSubscription.findOneAndUpdate(
      { user: req.user._id, deviceId },
      payload,
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Subscription registered', subscription: sub });
  } catch (error) {
    console.error('registerSubscription error:', error);
    res.status(500).json({ message: 'Failed to register subscription' });
  }
};

export const unregisterSubscription = async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) return res.status(400).json({ message: 'deviceId is required' });

    await PushSubscription.updateOne(
      { user: req.user._id, deviceId },
      { isActive: false }
    );

    res.status(200).json({ message: 'Subscription deactivated' });
  } catch (error) {
    console.error('unregisterSubscription error:', error);
    res.status(500).json({ message: 'Failed to unregister subscription' });
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const unreadCount = await NotificationDelivery.countDocuments({
      targetUserId: req.user._id,
      channel: 'in_app',
      status: 'sent',
      readAt: null
    });

    const deliveries = await NotificationDelivery.find({
      targetUserId: req.user._id,
      channel: 'in_app'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('eventId')
      .lean();

    const notifications = deliveries
      .filter(d => d.eventId) // ensure event didn't get deleted
      .map(d => ({
        id: d._id,
        eventId: d.eventId._id,
        type: d.eventId.type,
        title: d.eventId.title,
        body: d.eventId.body,
        deeplink: d.eventId.deeplink,
        orderId: d.eventId.orderId,
        isRead: !!d.readAt,
        status: d.status,
        createdAt: d.createdAt
      }));

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('getMyNotifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

export const markRead = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const result = await NotificationDelivery.findOneAndUpdate(
      { _id: deliveryId, targetUserId: req.user._id },
      { readAt: new Date(), status: 'read' },
      { new: true }
    );

    if (!result) return res.status(404).json({ message: 'Notification not found' });

    res.status(200).json({ message: 'Marked read', success: true });
  } catch (error) {
    console.error('markRead error:', error);
    res.status(500).json({ message: 'Failed to mark read' });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await NotificationDelivery.updateMany(
      { targetUserId: req.user._id, channel: 'in_app', readAt: null },
      { readAt: new Date(), status: 'read' }
    );

    res.status(200).json({ message: 'All marked read', success: true });
  } catch (error) {
    console.error('markAllRead error:', error);
    res.status(500).json({ message: 'Failed to mark all read' });
  }
};
