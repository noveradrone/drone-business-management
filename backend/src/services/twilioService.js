const { twilioAccountSid, twilioAuthToken, twilioFromPhone } = require("../config");

function hasTwilioConfig() {
  return Boolean(twilioAccountSid && twilioAuthToken && twilioFromPhone);
}

async function sendSms(to, body) {
  if (!hasTwilioConfig()) {
    throw new Error("Twilio non configure: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE requis");
  }

  const payload = new URLSearchParams({
    To: to,
    From: twilioFromPhone,
    Body: body
  });

  const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload.toString()
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Erreur Twilio (${response.status}): ${errBody.slice(0, 180)}`);
  }

  return response.json();
}

module.exports = {
  sendSms
};
