import type { PropAiSyncPluginApi } from "propai/plugin-sdk/whatsapp";
import { emptyPluginConfigSchema } from "propai/plugin-sdk/whatsapp";
import { whatsappPlugin } from "./src/channel.js";
import { handleWhatsAppCloudWebhook } from "./src/cloud.js";
import { setWhatsAppRuntime } from "./src/runtime.js";

const plugin = {
  id: "whatsapp",
  name: "WhatsApp",
  description: "WhatsApp channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: PropAiSyncPluginApi) {
    setWhatsAppRuntime(api.runtime);
    api.registerChannel({ plugin: whatsappPlugin });
    api.registerHttpRoute({
      path: "/webhooks/whatsapp",
      auth: "plugin",
      match: "exact",
      handler: handleWhatsAppCloudWebhook,
    });
  },
};

export default plugin;



