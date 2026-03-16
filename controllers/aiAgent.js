import MessageRecievedLogs from "../models/messageRecievedLogs.js";

/****
 * The following function recieveMessage forms the layer 1 of our AI Agent, it performs two primary tasks
 * First: It acts as a gateway for the Twillio Webhook to send messagge to.
 * Second: Store the message recieved in DB.
 */

export const recieveMessage = async (req, res) => {
  try {
    console.log("Message Recieved from twillio");
    console.log(req.body);

    const savedMessage = await MessageRecievedLogs.create(req.body);

    res.status(201).json({
      ok: true,
      message: "Message recieved successfully.",
      id: savedMessage._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
