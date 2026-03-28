import test from "node:test";
import assert from "node:assert/strict";
import {
  applyResolvedChoice,
  buildChoiceSelectionTranscript,
  CHOICE_KEYS,
  clearDeliveryLocation,
  ensureCheckoutState,
  invalidateCartConfirmations,
  isChoiceAlreadyResolved,
  markDeliveryCoverageSkipped,
  parseStructuredAgentReply,
  rememberDeliveryLocation,
  recordPendingChoice,
  resolveIncomingChoice,
  setAwaitingDeliveryLocation,
  syncExplicitChoiceMentions,
} from "./interactiveFlow.js";

const createSession = () => ({
  checkoutState: {
    pendingChoice: null,
    resolvedChoices: {
      cartConfirmed: null,
      paymentMethod: "",
      fulfillmentMode: "",
      orderConfirmed: null,
    },
    awaitingDeliveryLocation: false,
    deliveryCoverageStatus: "unknown",
    deliveryLocation: {
      latitude: null,
      longitude: null,
      address: "",
      label: "",
    },
    deliveryAddress: "",
    notes: "",
  },
});

test("parseStructuredAgentReply accepts valid text replies", () => {
  const result = parseStructuredAgentReply(
    JSON.stringify({
      type: "text",
      message: "Please share your delivery address.",
    })
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.reply, {
    type: "text",
    message: "Please share your delivery address.",
    hint: undefined,
  });
});

test("parseStructuredAgentReply normalizes button replies", () => {
  const result = parseStructuredAgentReply(
    JSON.stringify({
      type: "buttons",
      message: "How would you like to pay?",
      choiceKey: "payment_method",
      buttons: [
        { label: "COD", value: "cod" },
        { label: "UPI", value: "upi" },
      ],
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.reply.type, "buttons");
  assert.equal(result.reply.choiceKey, "payment_method");
  assert.deepEqual(result.reply.buttons, [
    { label: "COD", value: "cod", payload: "payment_method:cod" },
    { label: "UPI", value: "upi", payload: "payment_method:upi" },
  ]);
});

test("parseStructuredAgentReply rejects buttons without choiceKey", () => {
  const result = parseStructuredAgentReply(
    JSON.stringify({
      type: "buttons",
      message: "How would you like to pay?",
      buttons: ["COD", "UPI"],
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_choice_key");
});

test("resolveIncomingChoice consumes button payload and marks choice resolved", () => {
  const session = createSession();
  recordPendingChoice(session, {
    type: "buttons",
    message: "How would you like to pay?",
    choiceKey: CHOICE_KEYS.PAYMENT_METHOD,
    buttons: [
      { label: "COD", value: "cod", payload: "payment_method:cod" },
      { label: "UPI", value: "upi", payload: "payment_method:upi" },
    ],
  });

  const selection = resolveIncomingChoice(session, {
    buttonPayload: "payment_method:upi",
  });

  assert.deepEqual(selection, {
    kind: "payment_method",
    value: "upi",
    label: "UPI",
    source: "button_payload",
  });
  assert.equal(session.checkoutState.pendingChoice, null);
  assert.equal(session.checkoutState.resolvedChoices.paymentMethod, "upi");
  assert.equal(isChoiceAlreadyResolved(session, CHOICE_KEYS.PAYMENT_METHOD), true);
});

test("resolveIncomingChoice matches typed reply against a pending choice", () => {
  const session = createSession();
  recordPendingChoice(session, {
    type: "buttons",
    message: "Delivery or pickup?",
    choiceKey: CHOICE_KEYS.FULFILLMENT_MODE,
    buttons: [
      {
        label: "Delivery",
        value: "delivery",
        payload: "fulfillment_mode:delivery",
      },
      {
        label: "Pickup",
        value: "pickup",
        payload: "fulfillment_mode:pickup",
      },
    ],
  });

  const selection = resolveIncomingChoice(session, {
    body: "Pickup",
  });

  assert.deepEqual(selection, {
    kind: "fulfillment_mode",
    value: "pickup",
    label: "Pickup",
    source: "button_text",
  });
  assert.equal(session.checkoutState.resolvedChoices.fulfillmentMode, "pickup");
  assert.equal(session.checkoutState.deliveryAddress, "");
  assert.match(buildChoiceSelectionTranscript(selection), /matching reply/);
});

test("invalidateCartConfirmations clears cart and final-order confirmations", () => {
  const session = createSession();
  ensureCheckoutState(session);
  applyResolvedChoice(session, CHOICE_KEYS.CART_CONFIRMATION, "yes");
  applyResolvedChoice(session, CHOICE_KEYS.ORDER_CONFIRMATION, "yes");

  invalidateCartConfirmations(session);

  assert.equal(session.checkoutState.resolvedChoices.cartConfirmed, null);
  assert.equal(session.checkoutState.resolvedChoices.orderConfirmed, null);
});

test("syncExplicitChoiceMentions updates payment and fulfillment choices from text", () => {
  const session = createSession();
  syncExplicitChoiceMentions(session, "Please make it UPI and pickup");

  assert.equal(session.checkoutState.resolvedChoices.paymentMethod, "upi");
  assert.equal(session.checkoutState.resolvedChoices.fulfillmentMode, "pickup");
  assert.equal(session.checkoutState.resolvedChoices.orderConfirmed, null);
});

test("delivery choice waits for location when delivery zone is configured", () => {
  const session = createSession();
  session.$locals = { deliveryZoneConfigured: true };

  applyResolvedChoice(session, CHOICE_KEYS.FULFILLMENT_MODE, "delivery");

  assert.equal(session.checkoutState.awaitingDeliveryLocation, true);
  assert.equal(session.checkoutState.deliveryCoverageStatus, "unknown");
  assert.equal(session.checkoutState.deliveryAddress, "");
});

test("pickup clears stored delivery location state", () => {
  const session = createSession();
  rememberDeliveryLocation(
    session,
    {
      latitude: 12.34,
      longitude: 56.78,
      address: "Test Address",
      label: "Home",
    },
    "inside"
  );
  session.checkoutState.deliveryAddress = "Test Address";

  applyResolvedChoice(session, CHOICE_KEYS.FULFILLMENT_MODE, "pickup");

  assert.equal(session.checkoutState.awaitingDeliveryLocation, false);
  assert.equal(session.checkoutState.deliveryCoverageStatus, "unknown");
  assert.equal(session.checkoutState.deliveryLocation.latitude, null);
  assert.equal(session.checkoutState.deliveryAddress, "");
});

test("delivery choice skips location wait when delivery zone is not configured", () => {
  const session = createSession();

  applyResolvedChoice(session, CHOICE_KEYS.FULFILLMENT_MODE, "delivery");

  assert.equal(session.checkoutState.awaitingDeliveryLocation, false);
  assert.equal(session.checkoutState.deliveryCoverageStatus, "skipped");
});
