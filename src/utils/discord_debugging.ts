export async function postToDiscordWebhook(message: string) {
  const webhookUrl = "";
  const payload = { content: message };
  const request = {
    url: webhookUrl,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };

  try {
    const [response, data] = await Application.scheduleRequest(request);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Discord webhook error: ${response.status}`);
    }
    console.log("Successfully posted to Discord webhook");
  } catch (error) {
    console.error("Error posting to Discord webhook:", error);
  }
}
