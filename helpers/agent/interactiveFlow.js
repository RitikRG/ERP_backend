const MAX_BUTTONS = 3;

export const CHOICE_KEYS = {
  CART_CONFIRMATION: "cart_confirmation",
  PAYMENT_METHOD: "payment_method",
  FULFILLMENT_MODE: "fulfillment_mode",
  ORDER_CONFIRMATION: "order_confirmation",
};

const VALID_CHOICE_KEYS = new Set(Object.values(CHOICE_KEYS));

const VALID_VALUES = {
  [CHOICE_KEYS.CART_CONFIRMATION]: new Set(["yes", "no"]),
  [CHOICE_KEYS.PAYMENT_METHOD]: new Set(["cod", "upi"]),
  [CHOICE_KEYS.FULFILLMENT_MODE]: new Set(["delivery", "pickup"]),
  [CHOICE_KEYS.ORDER_CONFIRMATION]: new Set(["yes", "no"]),
};

const normalizeText = (value) => String(value || "").trim();

const normalizeKey = (value) => normalizeText(value).toLowerCase();

const createEmptyDeliveryLocation = () => ({
  latitude: null,
  longitude: null,
  address: "",
  label: "",
});

export const markCheckoutStateModified = (session) => {
  if (typeof session?.markModified === "function") {
    session.markModified("checkoutState");
  }
};

const setCheckoutStateValue = (session, path, value) => {
  if (typeof session?.set === "function") {
    session.set(`checkoutState.${path}`, value);
    return;
  }

  const state = ensureCheckoutState(session);
  const segments = String(path).split(".");
  let target = state;

  while (segments.length > 1) {
    const segment = segments.shift();
    target[segment] = target[segment] || {};
    target = target[segment];
  }

  target[segments[0]] = value;
};

const normalizeChoiceValueFromLabel = (choiceKey, label) => {
  const normalized = normalizeKey(label);

  if (
    choiceKey === CHOICE_KEYS.CART_CONFIRMATION ||
    choiceKey === CHOICE_KEYS.ORDER_CONFIRMATION
  ) {
    if (
      normalized.includes("yes") ||
      normalized.includes("haan") ||
      normalized.includes("add") ||
      normalized.includes("place") ||
      normalized.includes("confirm")
    ) {
      return "yes";
    }

    if (
      normalized.includes("no") ||
      normalized.includes("nahi") ||
      normalized.includes("cancel")
    ) {
      return "no";
    }
  }

  if (choiceKey === CHOICE_KEYS.PAYMENT_METHOD) {
    if (
      normalized.includes("upi") ||
      normalized.includes("online") ||
      normalized.includes("pay online")
    ) {
      return "upi";
    }

    if (
      normalized.includes("cod") ||
      normalized.includes("cash on delivery") ||
      normalized === "cash"
    ) {
      return "cod";
    }
  }

  if (choiceKey === CHOICE_KEYS.FULFILLMENT_MODE) {
    if (normalized.includes("delivery")) {
      return "delivery";
    }

    if (normalized.includes("pickup") || normalized.includes("pick up")) {
      return "pickup";
    }
  }

  return normalized;
};

const buildChoicePayload = (choiceKey, value) => `${choiceKey}:${value}`;

const cloneOption = (option) => ({
  label: option.label,
  value: option.value,
  payload: option.payload,
});

export const ensureCheckoutState = (session) => {
  session.checkoutState = session.checkoutState || {};

  const state = session.checkoutState;
  state.pendingChoice = state.pendingChoice || null;
  state.resolvedChoices = state.resolvedChoices || {};
  if (state.awaitingDeliveryLocation === undefined) {
    state.awaitingDeliveryLocation = false;
  }
  if (!state.deliveryCoverageStatus) {
    state.deliveryCoverageStatus = "unknown";
  }
  state.deliveryLocation = state.deliveryLocation || createEmptyDeliveryLocation();
  if (state.deliveryLocation.latitude === undefined) {
    state.deliveryLocation.latitude = null;
  }
  if (state.deliveryLocation.longitude === undefined) {
    state.deliveryLocation.longitude = null;
  }
  if (state.deliveryLocation.address === undefined) {
    state.deliveryLocation.address = "";
  }
  if (state.deliveryLocation.label === undefined) {
    state.deliveryLocation.label = "";
  }
  state.deliveryAddress = state.deliveryAddress || "";
  state.notes = state.notes || "";

  if (state.resolvedChoices.cartConfirmed === undefined) {
    state.resolvedChoices.cartConfirmed = null;
  }

  if (!state.resolvedChoices.paymentMethod) {
    state.resolvedChoices.paymentMethod = "";
  }

  if (!state.resolvedChoices.fulfillmentMode) {
    state.resolvedChoices.fulfillmentMode = "";
  }

  if (state.resolvedChoices.orderConfirmed === undefined) {
    state.resolvedChoices.orderConfirmed = null;
  }

  return state;
};

const isDeliveryZoneConfigured = (session) =>
  Boolean(session?.$locals?.deliveryZoneConfigured);

export const clearDeliveryLocation = (session, options = {}) => {
  const state = ensureCheckoutState(session);
  const shouldClearAddress = options.clearAddress !== false;

  setCheckoutStateValue(session, "awaitingDeliveryLocation", false);
  setCheckoutStateValue(session, "deliveryCoverageStatus", "unknown");
  setCheckoutStateValue(session, "deliveryLocation", createEmptyDeliveryLocation());

  if (shouldClearAddress) {
    setCheckoutStateValue(session, "deliveryAddress", "");
  }

  markCheckoutStateModified(session);
};

export const setAwaitingDeliveryLocation = (session) => {
  ensureCheckoutState(session);
  setCheckoutStateValue(session, "awaitingDeliveryLocation", true);
  setCheckoutStateValue(session, "deliveryCoverageStatus", "unknown");
  setCheckoutStateValue(session, "deliveryLocation", createEmptyDeliveryLocation());
  setCheckoutStateValue(session, "deliveryAddress", "");
  markCheckoutStateModified(session);
};

export const markDeliveryCoverageSkipped = (session) => {
  ensureCheckoutState(session);
  setCheckoutStateValue(session, "awaitingDeliveryLocation", false);
  setCheckoutStateValue(session, "deliveryCoverageStatus", "skipped");
  markCheckoutStateModified(session);
};

export const rememberDeliveryLocation = (
  session,
  deliveryLocation,
  coverageStatus = "inside"
) => {
  ensureCheckoutState(session);
  setCheckoutStateValue(session, "deliveryLocation", {
    ...createEmptyDeliveryLocation(),
    ...(deliveryLocation || {}),
  });
  setCheckoutStateValue(session, "awaitingDeliveryLocation", false);
  setCheckoutStateValue(session, "deliveryCoverageStatus", coverageStatus);
  markCheckoutStateModified(session);
};

export const clearPendingChoice = (session) => {
  const state = ensureCheckoutState(session);
  state.pendingChoice = null;
  markCheckoutStateModified(session);
};

export const rememberDeliveryAddress = (session, deliveryAddress) => {
  const state = ensureCheckoutState(session);
  const normalizedAddress = normalizeText(deliveryAddress);
  setCheckoutStateValue(session, "deliveryAddress", normalizedAddress);

  if (normalizedAddress) {
    setCheckoutStateValue(session, "deliveryLocation.address", normalizedAddress);
  }

  markCheckoutStateModified(session);
};

export const rememberNotes = (session, notes) => {
  const state = ensureCheckoutState(session);
  state.notes = normalizeText(notes);
  markCheckoutStateModified(session);
};

export const invalidateOrderConfirmation = (session) => {
  const state = ensureCheckoutState(session);
  state.resolvedChoices.orderConfirmed = null;

  if (state.pendingChoice?.kind === CHOICE_KEYS.ORDER_CONFIRMATION) {
    state.pendingChoice = null;
  }

  markCheckoutStateModified(session);
};

export const invalidateCartConfirmations = (session) => {
  const state = ensureCheckoutState(session);
  state.resolvedChoices.cartConfirmed = null;
  invalidateOrderConfirmation(session);

  if (state.pendingChoice?.kind === CHOICE_KEYS.CART_CONFIRMATION) {
    state.pendingChoice = null;
  }
};

export const applyResolvedChoice = (session, choiceKey, value) => {
  const state = ensureCheckoutState(session);
  const normalizedValue = normalizeChoiceValueFromLabel(choiceKey, value);

  switch (choiceKey) {
    case CHOICE_KEYS.CART_CONFIRMATION:
      state.resolvedChoices.cartConfirmed = normalizedValue === "yes";
      invalidateOrderConfirmation(session);
      break;
    case CHOICE_KEYS.PAYMENT_METHOD:
      if (state.resolvedChoices.paymentMethod !== normalizedValue) {
        state.resolvedChoices.paymentMethod = normalizedValue;
        invalidateOrderConfirmation(session);
      }
      break;
    case CHOICE_KEYS.FULFILLMENT_MODE:
      if (state.resolvedChoices.fulfillmentMode !== normalizedValue) {
        state.resolvedChoices.fulfillmentMode = normalizedValue;
        invalidateOrderConfirmation(session);
      }

      if (normalizedValue === "pickup") {
        clearDeliveryLocation(session);
      } else if (normalizedValue === "delivery") {
        if (isDeliveryZoneConfigured(session)) {
          if (state.deliveryCoverageStatus !== "inside") {
            setAwaitingDeliveryLocation(session);
          } else {
            state.awaitingDeliveryLocation = false;
          }
        } else {
          markDeliveryCoverageSkipped(session);
        }
      }
      break;
    case CHOICE_KEYS.ORDER_CONFIRMATION:
      state.resolvedChoices.orderConfirmed = normalizedValue === "yes";
      break;
    default:
      break;
  }

  state.pendingChoice = null;
  markCheckoutStateModified(session);
};

export const syncExplicitChoiceMentions = (session, transcript) => {
  const lower = normalizeKey(transcript);

  if (!lower) {
    return;
  }

  const mentionsUpi =
    /\bupi\b/.test(lower) ||
    lower.includes("online payment") ||
    lower.includes("pay online");
  const mentionsCod =
    /\bcod\b/.test(lower) || lower.includes("cash on delivery");

  if (mentionsUpi !== mentionsCod) {
    applyResolvedChoice(
      session,
      CHOICE_KEYS.PAYMENT_METHOD,
      mentionsUpi ? "upi" : "cod"
    );
  }

  const mentionsDelivery = /\bdelivery\b/.test(lower);
  const mentionsPickup = /\bpickup\b/.test(lower) || lower.includes("pick up");

  if (mentionsDelivery !== mentionsPickup) {
    applyResolvedChoice(
      session,
      CHOICE_KEYS.FULFILLMENT_MODE,
      mentionsDelivery ? "delivery" : "pickup"
    );
  }
};

export const buildCheckoutStateContext = (session) => {
  const state = ensureCheckoutState(session);
  const pendingChoice = state.pendingChoice
    ? `${state.pendingChoice.kind} waiting for one of: ${state.pendingChoice.options
        .map((option) => option.label)
        .join(", ")}`
    : "none";

  const cartConfirmed =
    state.resolvedChoices.cartConfirmed === null
      ? "unknown"
      : state.resolvedChoices.cartConfirmed
        ? "yes"
        : "no";

  const orderConfirmed =
    state.resolvedChoices.orderConfirmed === null
      ? "unknown"
      : state.resolvedChoices.orderConfirmed
        ? "yes"
        : "no";

  return [
    "CHECKOUT STATE:",
    `- Cart confirmation already chosen: ${cartConfirmed}`,
    `- Payment method already chosen: ${state.resolvedChoices.paymentMethod || "unknown"}`,
    `- Fulfillment mode already chosen: ${state.resolvedChoices.fulfillmentMode || "unknown"}`,
    `- Final order confirmation already chosen: ${orderConfirmed}`,
    `- Awaiting customer current location: ${state.awaitingDeliveryLocation ? "yes" : "no"}`,
    `- Delivery coverage status: ${state.deliveryCoverageStatus || "unknown"}`,
    `- Known delivery location: ${
      state.deliveryLocation.latitude !== null &&
      state.deliveryLocation.longitude !== null
        ? `${state.deliveryLocation.latitude}, ${state.deliveryLocation.longitude}`
        : "unknown"
    }`,
    `- Known delivery address: ${state.deliveryAddress || "unknown"}`,
    `- Known notes: ${state.notes || "none"}`,
    `- Pending choice awaiting reply: ${pendingChoice}`,
    "- If a choice is already known from checkout state, do not ask the same choice again unless the customer explicitly changes it.",
    "- If the customer selected a quick reply button, treat that as explicit confirmation for that exact choice.",
    "- If fulfillment mode is delivery and checkout state says location is awaited, ask for the customer's current WhatsApp location instead of asking for a typed address.",
    "- Ask for a typed delivery address only after location validation passes, or when delivery coverage is skipped because the shop has no configured delivery zone.",
  ].join("\n");
};

export const parseStructuredAgentReply = (rawContent) => {
  let parsed;

  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    return {
      ok: false,
      reason: "invalid_json",
      fallbackMessage: rawContent,
      errors: ["Assistant reply was not valid JSON."],
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: "invalid_shape",
      fallbackMessage: rawContent,
      errors: ["Assistant reply must be a JSON object."],
    };
  }

  const type = normalizeKey(parsed.type);
  const message = normalizeText(parsed.message);
  const hint = normalizeText(parsed.hint);

  if (!message) {
    return {
      ok: false,
      reason: "missing_message",
      fallbackMessage: rawContent,
      errors: ["Assistant reply is missing a message."],
    };
  }

  if (type === "text") {
    return {
      ok: true,
      reply: {
        type: "text",
        message,
        hint: hint || undefined,
      },
    };
  }

  if (type !== "buttons") {
    return {
      ok: false,
      reason: "unsupported_type",
      fallbackMessage: message,
      errors: ['Assistant reply type must be "text" or "buttons".'],
    };
  }

  const choiceKey = normalizeKey(parsed.choiceKey);

  if (!VALID_CHOICE_KEYS.has(choiceKey)) {
    return {
      ok: false,
      reason: "invalid_choice_key",
      fallbackMessage: message,
      errors: ["Button replies must include a valid choiceKey."],
    };
  }

  if (!Array.isArray(parsed.buttons) || parsed.buttons.length === 0) {
    return {
      ok: false,
      reason: "missing_buttons",
      fallbackMessage: message,
      errors: ["Button replies must include at least one button."],
    };
  }

  if (parsed.buttons.length > MAX_BUTTONS) {
    return {
      ok: false,
      reason: "too_many_buttons",
      fallbackMessage: message,
      errors: [`Button replies can have at most ${MAX_BUTTONS} buttons.`],
    };
  }

  const buttons = [];
  const seenLabels = new Set();
  const seenValues = new Set();

  for (const rawButton of parsed.buttons) {
    const button =
      typeof rawButton === "string"
        ? {
            label: normalizeText(rawButton),
            value: normalizeChoiceValueFromLabel(choiceKey, rawButton),
          }
        : {
            label: normalizeText(rawButton?.label),
            value: normalizeChoiceValueFromLabel(
              choiceKey,
              rawButton?.value || rawButton?.label
            ),
          };

    if (!button.label) {
      return {
        ok: false,
        reason: "missing_button_label",
        fallbackMessage: message,
        errors: ["Each button must have a label."],
      };
    }

    if (button.label.length > 20) {
      return {
        ok: false,
        reason: "button_label_too_long",
        fallbackMessage: message,
        errors: [`Button label "${button.label}" exceeds 20 characters.`],
      };
    }

    if (!VALID_VALUES[choiceKey].has(button.value)) {
      return {
        ok: false,
        reason: "invalid_button_value",
        fallbackMessage: message,
        errors: [`Button "${button.label}" has invalid value "${button.value}".`],
      };
    }

    if (seenLabels.has(button.label.toLowerCase())) {
      return {
        ok: false,
        reason: "duplicate_button_label",
        fallbackMessage: message,
        errors: [`Duplicate button label "${button.label}".`],
      };
    }

    if (seenValues.has(button.value)) {
      return {
        ok: false,
        reason: "duplicate_button_value",
        fallbackMessage: message,
        errors: [`Duplicate button value "${button.value}".`],
      };
    }

    seenLabels.add(button.label.toLowerCase());
    seenValues.add(button.value);
    buttons.push({
      ...button,
      payload: buildChoicePayload(choiceKey, button.value),
    });
  }

  return {
    ok: true,
    reply: {
      type: "buttons",
      message,
      choiceKey,
      buttons,
    },
  };
};

export const isChoiceAlreadyResolved = (session, choiceKey) => {
  const state = ensureCheckoutState(session);

  switch (choiceKey) {
    case CHOICE_KEYS.CART_CONFIRMATION:
      return state.resolvedChoices.cartConfirmed !== null;
    case CHOICE_KEYS.PAYMENT_METHOD:
      return Boolean(state.resolvedChoices.paymentMethod);
    case CHOICE_KEYS.FULFILLMENT_MODE:
      return Boolean(state.resolvedChoices.fulfillmentMode);
    case CHOICE_KEYS.ORDER_CONFIRMATION:
      return state.resolvedChoices.orderConfirmed !== null;
    default:
      return false;
  }
};

export const buildResolvedChoiceCorrection = (session, choiceKey) => {
  const state = ensureCheckoutState(session);

  const valueByChoice = {
    [CHOICE_KEYS.CART_CONFIRMATION]:
      state.resolvedChoices.cartConfirmed === null
        ? "unknown"
        : state.resolvedChoices.cartConfirmed
          ? "yes"
          : "no",
    [CHOICE_KEYS.PAYMENT_METHOD]:
      state.resolvedChoices.paymentMethod || "unknown",
    [CHOICE_KEYS.FULFILLMENT_MODE]:
      state.resolvedChoices.fulfillmentMode || "unknown",
    [CHOICE_KEYS.ORDER_CONFIRMATION]:
      state.resolvedChoices.orderConfirmed === null
        ? "unknown"
        : state.resolvedChoices.orderConfirmed
          ? "yes"
          : "no",
  };

  return [
    `Do not ask for "${choiceKey}" again.`,
    `It is already resolved as "${valueByChoice[choiceKey]}".`,
    "Continue to the next missing step and respond in the required JSON format.",
  ].join(" ");
};

export const recordPendingChoice = (session, reply) => {
  const state = ensureCheckoutState(session);

  if (reply.type !== "buttons") {
    state.pendingChoice = null;
    markCheckoutStateModified(session);
    return;
  }

  state.pendingChoice = {
    kind: reply.choiceKey,
    message: reply.message,
    options: reply.buttons.map(cloneOption),
    askedAt: new Date(),
  };
  markCheckoutStateModified(session);
};

export const resolveIncomingChoice = (session, inbound = {}) => {
  const state = ensureCheckoutState(session);

  if (!state.pendingChoice?.kind || !Array.isArray(state.pendingChoice.options)) {
    return null;
  }

  const choiceKind = state.pendingChoice.kind;
  const options = state.pendingChoice.options.map((option) => ({
    label: normalizeText(option.label),
    value: normalizeText(option.value),
    payload: normalizeText(option.payload),
  }));

  const payloadCandidate = normalizeText(inbound.buttonPayload);
  if (payloadCandidate) {
    const matchedByPayload = options.find(
      (option) => option.payload === payloadCandidate
    );

    if (matchedByPayload) {
      applyResolvedChoice(session, choiceKind, matchedByPayload.value);

      return {
        kind: choiceKind,
        value: matchedByPayload.value,
        label: matchedByPayload.label,
        source: "button_payload",
      };
    }
  }

  const textCandidates = [
    normalizeText(inbound.buttonText),
    normalizeText(inbound.body),
  ]
    .filter(Boolean)
    .map((candidate) => normalizeKey(candidate));

  for (const candidate of textCandidates) {
    const matchedByText = options.find((option) => {
      const normalizedLabel = normalizeKey(option.label);
      const normalizedValue = normalizeKey(option.value);
      return candidate === normalizedLabel || candidate === normalizedValue;
    });

    if (matchedByText) {
      applyResolvedChoice(session, choiceKind, matchedByText.value);

      return {
        kind: choiceKind,
        value: matchedByText.value,
        label: matchedByText.label,
        source: "button_text",
      };
    }
  }

  return null;
};

export const buildChoiceSelectionTranscript = (selection) =>
  `Customer selected ${selection.kind}: ${selection.value} via ${
    selection.source === "button_payload" ? "quick reply" : "matching reply"
  }. This choice is already confirmed.`;
