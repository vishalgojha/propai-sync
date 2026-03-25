type JsonLdPayload = Record<string, unknown>;

export function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return;
  let node = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attribute, key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

export function upsertCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let node = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }
  node.setAttribute('href', href);
}

export function upsertJsonLd(id: string, payload: JsonLdPayload) {
  if (typeof document === 'undefined') return;
  let node = document.getElementById(id) as HTMLScriptElement | null;
  if (!node) {
    node = document.createElement('script');
    node.type = 'application/ld+json';
    node.id = id;
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify(payload);
}

export function applyMarketingSeo({
  title,
  description,
  canonicalUrl,
  schemaId,
  schema,
}: {
  title: string;
  description: string;
  canonicalUrl: string;
  schemaId: string;
  schema: JsonLdPayload;
}) {
  if (typeof document === 'undefined') return;
  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('property', 'og:site_name', 'PropAi Sync');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertCanonical(canonicalUrl);
  upsertJsonLd(schemaId, schema);
}
