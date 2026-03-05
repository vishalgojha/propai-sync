export type JsonSchema = {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  additionalProperties?: boolean;
};

export type EncryptedSecretPayload = {
  alg: "aes-256-gcm";
  ivB64: string;
  dataB64: string;
  tagB64: string;
};

export type ApiAccessKeyRecord = {
  id: string;
  userId: string;
  label: string;
  saltB64: string;
  hashB64: string;
  createdAt: string;
  lastUsedAt?: string;
};

export type ServiceKeyRecord = {
  id: string;
  userId: string;
  service: string;
  label: string;
  encrypted: EncryptedSecretPayload;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};

export type HostedRecipeStep = {
  agent_slug: string;
  action_key: string;
  action_props?: Record<string, unknown>;
  format_guide?: string;
};

export type HostedRecipe = {
  userId: string;
  slug: string;
  name: string;
  version: number;
  steps: HostedRecipeStep[];
  createdAt: string;
  updatedAt: string;
};

export type HostedTriggerType = "cron" | "webhook" | "event";

export type HostedTrigger = {
  id: string;
  userId: string;
  name: string;
  type: HostedTriggerType;
  recipeSlug: string;
  schedule?: string;
  timezone?: string;
  eventName?: string;
  webhookToken?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HostedLogEntry = {
  id: string;
  userId: string;
  ts: string;
  type:
    | "orchestrate"
    | "orchestrate_error"
    | "trigger"
    | "trigger_error"
    | "recipe"
    | "recipe_error"
    | "cli";
  message: string;
  payload?: unknown;
};

export type HostedToolExecutionContext = {
  userId: string;
  task?: string;
  prev?: unknown;
  input?: unknown;
};

export type HostedToolDefinition = {
  key: string;
  service: string;
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

export type HostedToolExecutionResult = {
  tool: string;
  ok: boolean;
  startedAt: string;
  completedAt: string;
  output?: unknown;
  error?: string;
};

export type HostedAgentDefinition = {
  slug: string;
  name: string;
  description: string;
  tools: string[];
};

export type HostedAgentResult = {
  agent: string;
  ok: boolean;
  startedAt: string;
  completedAt: string;
  output?: unknown;
  error?: string;
};

export type HostedOrchestrateMode = "sequential" | "parallel";

export type HostedOrchestrateResult = {
  userId: string;
  task: string;
  mode: HostedOrchestrateMode;
  pipeline: string[];
  router: "byok-llm" | "heuristic" | "explicit";
  startedAt: string;
  completedAt: string;
  results: HostedAgentResult[];
};

export type UserDefinedAgentConfig = {
  slug: string;
  name: string;
  description: string;
  tools?: string[];
  defaultActionKey?: string;
  cliArgs?: string[];
};

export type ApiKeyAuthResult = {
  keyId: string;
  userId: string;
};
