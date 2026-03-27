export type BundledInstallPlan = {
  bundledSource: {
    localPath?: string | null;
  };
};

export function resolveBundledInstallPlanForCatalogEntry(params: {
  pluginId: string;
  npmSpec: string;
  findBundledSource: (lookup: { pluginId: string; npmSpec: string }) =>
    | { localPath?: string | null }
    | null
    | undefined;
}): BundledInstallPlan | null {
  const bundledSource = params.findBundledSource({
    pluginId: params.pluginId,
    npmSpec: params.npmSpec,
  });
  if (!bundledSource) {
    return null;
  }
  return { bundledSource };
}
