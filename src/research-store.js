const DATABASE_NAME = "nostr-research";
const DATABASE_VERSION = 2;

let databasePromise;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("events")) database.createObjectStore("events", { keyPath: "id" });
      if (!database.objectStoreNames.contains("recipes")) database.createObjectStore("recipes", { keyPath: "id" });
      if (!database.objectStoreNames.contains("collections")) database.createObjectStore("collections", { keyPath: "id" });
      if (!database.objectStoreNames.contains("runs")) {
        const runs = database.createObjectStore("runs", { keyPath: "id" });
        runs.createIndex("recipeId", "recipeId");
        runs.createIndex("completedAt", "completedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
  }).catch(() => null);
  return databasePromise;
}

async function transact(storeName, mode, action) {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    try { result = action(store); } catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).catch(() => null);
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeEvents(events, sourceIndex = new Map()) {
  if (!events?.length) return;
  await transact("events", "readwrite", (store) => {
    const storedAt = Date.now();
    for (const event of events) store.put({ ...event, _research: { storedAt, relays: sourceIndex.get(event.id) ?? [] } });
  });
}

export async function loadEvents(ids = [], sourceIndex) {
  if (!ids.length) return [];
  const database = await openDatabase();
  if (!database) return [];
  const transaction = database.transaction("events", "readonly");
  const store = transaction.objectStore("events");
  const events = await Promise.all(ids.map((id) => requestResult(store.get(id)).catch(() => null)));
  return events.filter(Boolean).map(({ _research, ...event }) => {
    if (sourceIndex && _research?.relays?.length) sourceIndex.set(event.id, _research.relays);
    return event;
  });
}

export async function saveCollection(collection) {
  await transact("collections", "readwrite", (store) => store.put(collection));
  return collection;
}

export async function listCollections() {
  const database = await openDatabase();
  if (!database) return [];
  const transaction = database.transaction("collections", "readonly");
  return (await requestResult(transaction.objectStore("collections").getAll()).catch(() => []))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function saveRecipe(recipe) {
  await transact("recipes", "readwrite", (store) => store.put(recipe));
  return recipe;
}

export async function listRecipes() {
  const database = await openDatabase();
  if (!database) return [];
  const transaction = database.transaction("recipes", "readonly");
  return (await requestResult(transaction.objectStore("recipes").getAll()).catch(() => []))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function saveRun(run) {
  await transact("runs", "readwrite", (store) => store.put(run));
  return run;
}

export async function latestRun(recipeId) {
  if (!recipeId) return null;
  const database = await openDatabase();
  if (!database) return null;
  const transaction = database.transaction("runs", "readonly");
  const request = transaction.objectStore("runs").index("recipeId").getAll(recipeId);
  const runs = await requestResult(request).catch(() => []);
  return runs.sort((a, b) => b.completedAt - a.completedAt)[0] ?? null;
}
