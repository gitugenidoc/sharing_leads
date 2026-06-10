const resolveSmsProvider = () =>
  String(process.env.SMS_PROVIDER || "manual").trim().toLowerCase() || "manual";

const buildPreparedSmsResult = (provider, reason) => ({
  status: "PREPARED",
  provider,
  providerMessageId: "",
  rawPayload: { reason },
});

const sendSms = async () => {
  const provider = resolveSmsProvider();

  if (process.env.SMS_SEND_MODE !== "provider") {
    return buildPreparedSmsResult(provider, "SMS_SEND_MODE is not provider");
  }

  if (provider === "manual") {
    return buildPreparedSmsResult(
      "manual",
      "No backend SMS provider configured. Keep SMS manual or plug a dedicated SMS provider.",
    );
  }

  return buildPreparedSmsResult(
    provider,
    `Unsupported SMS provider: ${provider}. Configure a dedicated SMS provider or keep SMS manual.`,
  );
};

module.exports = {
  sendSms,
};
