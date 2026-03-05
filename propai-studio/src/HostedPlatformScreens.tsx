import { useEffect, useMemo, useState } from "react";

export type HostedScreenId =
  | "hosted-keys"
  | "hosted-agents"
  | "hosted-tools"
  | "hosted-recipes"
  | "hosted-triggers"
  | "hosted-logs";

type RecipeStep = {
  agent_slug: string;
  action_key: string;
  action_props?: Record<string, unknown>;
  format_guide?: string;
};

const API_KEY_STORAGE_KEY = "propai-hosted-api-key";
const USER_ID_STORAGE_KEY = "propai-hosted-user-id";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

async function fetchJson<T>(params: {
  path: string;
  method?: "GET" | "POST" | "DELETE";
  apiKey?: string;
  body?: unknown;
}): Promise<T> {
  const response = await fetch(params.path, {
    method: params.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(params.apiKey ? { "X-API-Key": params.apiKey } : {}),
    },
    ...(params.body !== undefined ? { body: JSON.stringify(params.body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export function HostedPlatformScreen(props: { screen: HostedScreenId }) {
  const [apiKey, setApiKey] = useState(() => window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "");
  const [userId, setUserId] = useState(() => window.localStorage.getItem(USER_ID_STORAGE_KEY) ?? "demo-user");
  const [adminToken, setAdminToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [keysData, setKeysData] = useState<{ apiKeys: unknown[]; serviceKeys: unknown[] } | null>(null);
  const [agents, setAgents] = useState<Array<{ slug: string; name: string; description: string }>>([]);
  const [tools, setTools] = useState<Array<{ key: string; service: string; description: string }>>([]);
  const [recipes, setRecipes] = useState<Array<{ slug: string; name: string; steps: unknown[] }>>([]);
  const [triggers, setTriggers] = useState<Array<Record<string, unknown>>>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);

  const [newService, setNewService] = useState("openai");
  const [newServiceLabel, setNewServiceLabel] = useState("default");
  const [newServiceKey, setNewServiceKey] = useState("");
  const [newRecipeSlug, setNewRecipeSlug] = useState("daily-sync");
  const [newRecipeName, setNewRecipeName] = useState("Daily Sync");
  const [newRecipeSteps, setNewRecipeSteps] = useState(
    JSON.stringify(
      [
        {
          agent_slug: "sync-agent",
          action_key: "propai.sync",
          action_props: {},
        },
      ] satisfies RecipeStep[],
      null,
      2,
    ),
  );
  const [newTriggerName, setNewTriggerName] = useState("Daily Sync Trigger");
  const [newTriggerType, setNewTriggerType] = useState<"cron" | "webhook" | "event">("cron");
  const [newTriggerRecipeSlug, setNewTriggerRecipeSlug] = useState("daily-sync");
  const [newTriggerSchedule, setNewTriggerSchedule] = useState("0 9 * * *");
  const [newTriggerEventName, setNewTriggerEventName] = useState("orchestrate.completed");

  useEffect(() => {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  }, [apiKey]);

  useEffect(() => {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  }, [userId]);

  const hasApiKey = useMemo(() => apiKey.trim().length > 0, [apiKey]);

  useEffect(() => {
    const load = async () => {
      setError("");
      if (!hasApiKey && props.screen !== "hosted-keys") {
        return;
      }
      try {
        if (props.screen === "hosted-keys") {
          const payload = await fetchJson<{ apiKeys: unknown[]; serviceKeys: unknown[] }>({
            path: "/api/keys",
            apiKey: hasApiKey ? apiKey : undefined,
          });
          setKeysData(payload);
          return;
        }
        if (props.screen === "hosted-agents") {
          const payload = await fetchJson<{ agents: Array<{ slug: string; name: string; description: string }> }>({
            path: "/api/agents",
            apiKey,
          });
          setAgents(payload.agents);
          return;
        }
        if (props.screen === "hosted-tools") {
          const payload = await fetchJson<{ tools: Array<{ key: string; service: string; description: string }> }>({
            path: "/api/tools",
            apiKey,
          });
          setTools(payload.tools);
          return;
        }
        if (props.screen === "hosted-recipes") {
          const payload = await fetchJson<{ recipes: Array<{ slug: string; name: string; steps: unknown[] }> }>({
            path: "/api/recipes",
            apiKey,
          });
          setRecipes(payload.recipes);
          return;
        }
        if (props.screen === "hosted-triggers") {
          const payload = await fetchJson<{ triggers: Array<Record<string, unknown>> }>({
            path: "/api/triggers",
            apiKey,
          });
          setTriggers(payload.triggers);
          return;
        }
        if (props.screen === "hosted-logs") {
          const payload = await fetchJson<{ logs: Array<Record<string, unknown>> }>({
            path: "/api/logs?limit=100",
            apiKey,
          });
          setLogs(payload.logs);
        }
      } catch (err) {
        setError(toErrorMessage(err));
      }
    };
    void load();
  }, [apiKey, hasApiKey, props.screen, refreshTick]);

  const requestRefresh = () => setRefreshTick((value) => value + 1);

  const handleBootstrap = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = await fetchJson<{ apiKey: string; userId: string; keyId: string }>({
        path: "/api/auth/bootstrap",
        method: "POST",
        body: {
          userId,
          label: "studio",
          ...(adminToken.trim() ? { adminToken: adminToken.trim() } : {}),
        },
      });
      setApiKey(payload.apiKey);
      setNotice(`Created access key ${payload.keyId} for ${payload.userId}.`);
      requestRefresh();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveServiceKey = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fetchJson({
        path: "/api/keys",
        method: "POST",
        apiKey,
        body: {
          userId,
          service: newService,
          label: newServiceLabel,
          key: newServiceKey,
        },
      });
      setNotice(`Saved key for service ${newService}.`);
      setNewServiceKey("");
      requestRefresh();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRecipe = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const steps = JSON.parse(newRecipeSteps) as RecipeStep[];
      await fetchJson({
        path: "/api/recipes",
        method: "POST",
        apiKey,
        body: {
          userId,
          slug: newRecipeSlug,
          name: newRecipeName,
          steps,
        },
      });
      setNotice(`Saved recipe ${newRecipeSlug}.`);
      requestRefresh();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTrigger = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fetchJson({
        path: "/api/triggers",
        method: "POST",
        apiKey,
        body: {
          userId,
          name: newTriggerName,
          type: newTriggerType,
          recipeSlug: newTriggerRecipeSlug,
          schedule: newTriggerType === "cron" ? newTriggerSchedule : undefined,
          eventName: newTriggerType === "event" ? newTriggerEventName : undefined,
        },
      });
      setNotice(`Saved trigger ${newTriggerName}.`);
      requestRefresh();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (path: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fetchJson({
        path,
        method: "DELETE",
        apiKey,
      });
      requestRefresh();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Hosted Platform Control</h2>
        <p className="mt-1 text-sm text-slate-500">
          Auth via <code>X-API-Key</code>. Bootstrap first key once, then manage BYOK services.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">
            User ID
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            API Key
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="pk_propai_..."
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Admin Token (optional)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            onClick={handleBootstrap}
            disabled={busy}
          >
            Bootstrap Access Key
          </button>
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={requestRefresh}
          >
            Refresh
          </button>
        </div>
        {notice && <p className="mt-3 text-sm text-emerald-600">{notice}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </div>

      {props.screen === "hosted-keys" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Save BYOK Service Key</h3>
            <div className="mt-3 grid gap-2">
              <input
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                value={newService}
                onChange={(event) => setNewService(event.target.value)}
                placeholder="service slug (openai, anthropic, slack...)"
              />
              <input
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                value={newServiceLabel}
                onChange={(event) => setNewServiceLabel(event.target.value)}
                placeholder="label"
              />
              <input
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                value={newServiceKey}
                onChange={(event) => setNewServiceKey(event.target.value)}
                placeholder="API key"
              />
              <button
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                onClick={handleSaveServiceKey}
                disabled={busy || !hasApiKey}
              >
                Save Key
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Stored Keys</h3>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Access Keys</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                  {JSON.stringify(keysData?.apiKeys ?? [], null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Service Keys</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                  {JSON.stringify(keysData?.serviceKeys ?? [], null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {props.screen === "hosted-agents" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Agents</h3>
          <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(agents, null, 2)}
          </pre>
        </div>
      )}

      {props.screen === "hosted-tools" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Tool Registry</h3>
          <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(tools, null, 2)}
          </pre>
        </div>
      )}

      {props.screen === "hosted-recipes" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Create/Update Recipe</h3>
            <div className="mt-3 grid gap-2">
              <input
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                value={newRecipeSlug}
                onChange={(event) => setNewRecipeSlug(event.target.value)}
                placeholder="recipe slug"
              />
              <input
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                value={newRecipeName}
                onChange={(event) => setNewRecipeName(event.target.value)}
                placeholder="recipe name"
              />
              <textarea
                className="min-h-[240px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs"
                value={newRecipeSteps}
                onChange={(event) => setNewRecipeSteps(event.target.value)}
              />
              <button
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                onClick={handleSaveRecipe}
                disabled={busy || !hasApiKey}
              >
                Save Recipe
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Recipes</h3>
            <div className="mt-3 space-y-2">
              {recipes.map((recipe) => (
                <div key={recipe.slug} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{recipe.name}</p>
                      <p className="text-xs text-slate-500">{recipe.slug}</p>
                    </div>
                    <button
                      className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDelete(`/api/recipes/${encodeURIComponent(recipe.slug)}`)}
                    >
                      Delete
                    </button>
                  </div>
                  <pre className="mt-2 max-h-28 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
                    {JSON.stringify(recipe.steps, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {props.screen === "hosted-triggers" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Create Trigger</h3>
            <div className="mt-3 grid gap-2">
              <input
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                value={newTriggerName}
                onChange={(event) => setNewTriggerName(event.target.value)}
                placeholder="trigger name"
              />
              <select
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                value={newTriggerType}
                onChange={(event) => setNewTriggerType(event.target.value as "cron" | "webhook" | "event")}
              >
                <option value="cron">cron</option>
                <option value="webhook">webhook</option>
                <option value="event">event</option>
              </select>
              <input
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                value={newTriggerRecipeSlug}
                onChange={(event) => setNewTriggerRecipeSlug(event.target.value)}
                placeholder="recipe slug"
              />
              {newTriggerType === "cron" && (
                <input
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  value={newTriggerSchedule}
                  onChange={(event) => setNewTriggerSchedule(event.target.value)}
                  placeholder="cron schedule"
                />
              )}
              {newTriggerType === "event" && (
                <input
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  value={newTriggerEventName}
                  onChange={(event) => setNewTriggerEventName(event.target.value)}
                  placeholder="event name"
                />
              )}
              <button
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                onClick={handleSaveTrigger}
                disabled={busy || !hasApiKey}
              >
                Save Trigger
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Triggers</h3>
            <div className="mt-3 space-y-2">
              {triggers.map((trigger) => (
                <div key={String(trigger.id)} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{String(trigger.name ?? "Trigger")}</p>
                      <p className="text-xs text-slate-500">{String(trigger.type ?? "")}</p>
                    </div>
                    <button
                      className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDelete(`/api/triggers/${encodeURIComponent(String(trigger.id ?? ""))}`)}
                    >
                      Delete
                    </button>
                  </div>
                  <pre className="mt-2 max-h-28 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
                    {JSON.stringify(trigger, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {props.screen === "hosted-logs" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Execution Logs</h3>
          <pre className="mt-3 max-h-[520px] overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(logs, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
