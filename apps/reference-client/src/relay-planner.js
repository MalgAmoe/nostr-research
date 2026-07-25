const normalizeRelay = (value) => {
  try {
    const url = new URL(value);
    if (!["ws:", "wss:"].includes(url.protocol)) return "";
    url.hash = "";
    if (url.pathname === "/") url.pathname = "";
    return url.toString().replace(/\/$/, "");
  } catch { return ""; }
};

export function relayListFromEvent(event) {
  if (!event || event.kind !== 10002) return { read: [], write: [], all: [] };
  const read = [];
  const write = [];
  for (const tag of event.tags ?? []) {
    if (tag[0] !== "r") continue;
    const relay = normalizeRelay(tag[1]);
    if (!relay) continue;
    if (!tag[2] || tag[2] === "read") read.push(relay);
    if (!tag[2] || tag[2] === "write") write.push(relay);
  }
  return { read: [...new Set(read)], write: [...new Set(write)], all: [...new Set([...write, ...read])] };
}

export function planEntityRelays({ purpose = "authored", hints = [], relayList, fallback = [], limit = 6 } = {}) {
  const advertised = purpose === "mentions" ? relayList?.read ?? [] : relayList?.write ?? [];
  return [...new Set([...hints, ...advertised, ...fallback].map(normalizeRelay).filter(Boolean))].slice(0, limit);
}

export function relayQueryLimit(requested, information) {
  const advertised = Number(information?.limitations?.max_limit);
  return advertised > 0 ? Math.min(requested, advertised) : requested;
}
