import ChatSessions from "../../models/chatSessions.js";

/**
 * function Name: getOrCreateSession
 * description: getting any active chat session per user or creating one if needed.
 */
export const getOrCreateSession = async (customerNumber, organisationId) => {
  let session = await ChatSessions.findOne({
    mobile_number: customerNumber,
    active: true,
  });

  if (!session) {
    session = await ChatSessions.create({
      mobile_number: customerNumber,
      organisationId,
      history: [],
      cart: [],
      lastActivityAt: new Date(),
    });
    console.log(`[Session] New session created for ${customerNumber}`);
  } else {
    console.log(`[Session] Existing session found for ${customerNumber}`);
  }

  return session;
};
