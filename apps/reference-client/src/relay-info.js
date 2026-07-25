const relayInfoCache = new Map();

function informationUrl(relay) {
  const url = new URL(relay);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return url.toString();
}

export async function loadRelayInformation(relay) {
  if (relayInfoCache.has(relay)) return relayInfoCache.get(relay);
  const promise = Promise.race([
    fetch(informationUrl(relay), { headers: { accept: "application/nostr+json" } }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const document = await response.json();
      return {
        state: "available",
        name: document.name || new URL(relay).hostname,
        version: document.version || "",
        supportedNips: document.supported_nips ?? [],
        limitations: document.limitation ?? {},
      };
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("metadata timeout")), 3500)),
  ]).catch((error) => ({ state: "unavailable", error: error.message, supportedNips: [], limitations: {} }));
  relayInfoCache.set(relay, promise);
  return promise;
}

export async function loadRelayInformationSet(relays) {
  return new Map(await Promise.all(relays.map(async (relay) => [relay, await loadRelayInformation(relay)])));
}
