import webpush from 'web-push';
import NotificationEvent from '../models/notificationEvent.js';
import NotificationDelivery from '../models/notificationDelivery.js';
import PushSubscription from '../models/pushSubscription.js';
import User from '../models/user.js';
import dotenv from 'dotenv';
dotenv.config();

const OWNER_ONLINE_ORDERS_ROUTE = '/sales/online-orders';
const DELIVERY_ORDERS_ROUTE = '/delivery/orders';

// Configure web-push
if (process.env.WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.WEB_PUSH_CONTACT_EMAIL || 'mailto:admin@example.com',
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY,
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  );
} else {
  console.warn('VAPID keys not found. Push notifications will not be sent.');
}

const buildNotificationUrl = (pathname, query = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
};

export const buildOwnerOrderDeeplink = (orderId) =>
  buildNotificationUrl(OWNER_ONLINE_ORDERS_ROUTE, { orderId });

export const buildDeliveryOrderDeeplink = (orderId, scope = 'active') =>
  buildNotificationUrl(DELIVERY_ORDERS_ROUTE, { orderId, scope });

export const buildPushNotificationData = ({
  eventId,
  type,
  deeplink,
  orderId,
}) => ({
  eventId: eventId?.toString() || null,
  type,
  deeplink: deeplink || '',
  orderId: orderId?.toString() || null,
  onActionClick: deeplink
    ? {
        default: {
          operation: 'navigateLastFocusedOrOpen',
          url: deeplink,
        },
      }
    : undefined,
});

/**
 * Creates an event and handles all fan-out of in-app and push deliveries.
 * Should be called asynchronously (without await) in controllers to avoid blocking.
 */
export const processNotificationEvent = async (params) => {
  try {
    const { 
      type, 
      orgId, 
      actorUserId, 
      targetUserIds,   // Array of specific User ObjectIds (e.g., specific delivery agent)
      targetRoles,     // Array of roles to broadcast to (e.g., ["owner"])
      orderId, 
      saleId, 
      title, 
      body, 
      deeplink, 
      payloadSnapshot 
    } = params;

    // Resolve audience users
    let finalAudienceUsers = new Set(targetUserIds ? targetUserIds.map(id => id.toString()) : []);
    
    if (targetRoles && targetRoles.length > 0) {
      const roleUsers = await User.find({ org_id: orgId, type: { $in: targetRoles }, isActive: true }).select('_id');
      roleUsers.forEach(u => finalAudienceUsers.add(u._id.toString()));
    }

    const audienceArray = Array.from(finalAudienceUsers);
    
    if (audienceArray.length === 0) return; // No one to notify

    // 1. Create the Event
    const event = await NotificationEvent.create({
      type,
      orgId,
      actorUser: actorUserId,
      audienceRole: targetRoles || [],
      audienceUsers: audienceArray,
      orderId,
      saleId,
      title,
      body,
      deeplink,
      payloadSnapshot
    });

    // 2. Create in-app deliveries for all targeted users
    const inAppDeliveries = audienceArray.map(userId => ({
      eventId: event._id,
      channel: 'in_app',
      targetUserId: userId,
      status: 'sent' // in-app is instantly "sent" because it drops freely into their box
    }));
    await NotificationDelivery.insertMany(inAppDeliveries);

    // 3. Look up active push subscriptions for all targeted users
    const subscriptions = await PushSubscription.find({
      user: { $in: audienceArray },
      isActive: true
    });

    if (subscriptions.length === 0) return; // No push subscriptions

    // 4. Create push deliveries
    const pushDeliveries = subscriptions.map(sub => ({
      eventId: event._id,
      channel: 'push',
      targetUserId: sub.user,
      targetSubscriptionId: sub._id,
      targetDeviceId: sub.deviceId,
      status: 'queued'
    }));
    const savedPushDeliveries = await NotificationDelivery.insertMany(pushDeliveries);

    // 5. Send pushes via web-push
    const pushPayload = JSON.stringify({
      notification: {
        title,
        body,
        data: buildPushNotificationData({
          eventId: event._id,
          type,
          deeplink,
          orderId,
        })
      }
    });

    for (let i = 0; i < subscriptions.length; i++) {
      const sub = subscriptions[i];
      const deliveryRecord = savedPushDeliveries[i];

      try {
        const result = await webpush.sendNotification(sub.subscription, pushPayload);
        
        // Success
        await NotificationDelivery.updateOne(
          { _id: deliveryRecord._id },
          { status: 'sent', providerResponse: result }
        );
        await PushSubscription.updateOne(
          { _id: sub._id },
          { lastSuccessfulPushAt: new Date() }
        );
      } catch (error) {
        // Failure
        let isInactive = false;
        // 410 Gone means the subscription is no longer valid
        if (error.statusCode === 410 || error.statusCode === 404) {
          isInactive = true;
          await PushSubscription.updateOne(
            { _id: sub._id },
            { isActive: false, lastErrorAt: new Date() }
          );
        }

        await NotificationDelivery.updateOne(
          { _id: deliveryRecord._id },
          { status: 'failed', providerResponse: { error: error.message, statusCode: error.statusCode } }
        );
      }
    }
  } catch (error) {
    console.error('[NotificationService] Error processing event:', error);
  }
};
