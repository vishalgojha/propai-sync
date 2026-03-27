export async function waitForever(): Promise<void> {
  await new Promise<void>(() => {});
}
