import MessageRecievedLogs from "../models/messageRecievedLogs.js";

/****
 * The following function recieveMessage forms the layer 1 of our AI Agent, it performs two primary tasks
 * First: It acts as a gateway for the Twillio Webhook to send messagge to.
 * Second: Store the message recieved in DB.
 */
export const recieveMessage = async (req, res) => {
  // respond to Twilio immediately — non-negotiable
  res.status(200).send();

  try {
    const { From, Body, NumMedia, MediaUrl0 } = req.body;

    // log the raw message
    await MessageRecievedLogs.create(req.body);

    // determine message type and hand off to Layer 2
    const payload = {
      customerNumber: From, // session key
      text: NumMedia === "0" ? Body : null,
      audioUrl: NumMedia === "1" ? MediaUrl0 : null,
    };

    // this is where Layer 2 begins
    // await processMessage(payload)
  } catch (err) {
    console.error("Error in recieveMessage:", err.message);
  }
};
