export const DB_NAME = 'macro-diary';
export const DB_VERSION = 1;
export const DEFAULT_SETTINGS = {
  goals: { kcal: 2400, protein: 180, carbs: 250, fat: 70 },
};

const keyPaths = { foods: 'id', entries: 'id', weights: 'date', settings: 'key' };
const nutrients = ['kcal', 'protein', 'carbs', 'fat'];

function keyPath(storeName) {
  if (!Object.hasOwn(keyPaths, storeName)) throw new TypeError('Unknown store name');
  return keyPaths[storeName];
}

export function createMemoryBackend() {
  let stores = Object.fromEntries(Object.keys(keyPaths).map(name => [name, new Map()]));
  function store(name) {
    keyPath(name);
    return stores[name];
  }
  return {
    async getAll(name) { return structuredClone([...store(name).values()]); },
    async put(name, record) { return this.putMany(name, [record]); },
    async putMany(name, records) {
      const target = store(name);
      const copies = structuredClone(records);
      for (const record of copies) {
        if (record[keyPaths[name]] == null) throw new TypeError('Record needs a key');
      }
      for (const record of copies) target.set(record[keyPaths[name]], record);
    },
    async remove(name, key) { store(name).delete(key); },
    async clear(name) { store(name).clear(); },
    async replaceAll(replacement) {
      const next = {};
      for (const [name, path] of Object.entries(keyPaths)) {
        const target = new Map();
        for (const record of structuredClone(replacement[name])) {
          if (record[path] == null) throw new TypeError('Record needs a key');
          target.set(record[path], record);
        }
        next[name] = target;
      }
      stores = next;
    },
  };
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIdbBackend(indexedDB = globalThis.indexedDB) {
  let opening;
  function open() {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        if (!indexedDB) {
          reject(new Error('IndexedDB is unavailable'));
          return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          for (const [name, path] of Object.entries(keyPaths)) {
            const store = db.createObjectStore(name, { keyPath: path });
            if (name === 'entries') store.createIndex('byDate', 'date');
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); opening = undefined; };
          resolve(db);
        };
        request.onerror = () => { opening = undefined; reject(request.error); };
      });
    }
    return opening;
  }
  async function run(name, mode, operation) {
    keyPath(name);
    const db = await open();
    const transaction = db.transaction(name, mode);
    const completed = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });
    const requests = [];
    function track(request) {
      const result = requestResult(request);
      requests.push(result);
      return result;
    }
    try {
      operation(transaction.objectStore(name), track);
    } catch (error) {
      transaction.abort();
      await Promise.allSettled([...requests, completed]);
      throw error;
    }
    const [results] = await Promise.all([Promise.all(requests), completed]);
    return results;
  }
  return {
    async getAll(name) {
      const [records] = await run(name, 'readonly', (store, track) => track(store.getAll()));
      return records;
    },
    async put(name, record) {
      await run(name, 'readwrite', (store, track) => track(store.put(record)));
    },
    async putMany(name, records) {
      await run(name, 'readwrite', (store, track) => records.forEach(record => track(store.put(record))));
    },
    async remove(name, key) {
      await run(name, 'readwrite', (store, track) => track(store.delete(key)));
    },
    async clear(name) {
      await run(name, 'readwrite', (store, track) => track(store.clear()));
    },
    async replaceAll(replacement) {
      const db = await open();
      const transaction = db.transaction(Object.keys(keyPaths), 'readwrite');
      const completed = new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      });
      try {
        for (const name of Object.keys(keyPaths)) {
          const store = transaction.objectStore(name);
          store.clear();
          for (const record of replacement[name]) store.put(record);
        }
      } catch (error) {
        transaction.abort();
        await Promise.allSettled([completed]);
        throw error;
      }
      await completed;
    },
  };
}

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function recordObject(value, label) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function identifier(value, label) {
  requireValue(typeof value === 'string' && value.trim().length > 0, `${label} is required`);
}

function date(value) {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date must match YYYY-MM-DD');
}

function positive(value, label) {
  requireValue(Number.isFinite(value) && value > 0, `${label} must be a positive finite number`);
}

function validateNutrients(value) {
  for (const name of nutrients) {
    requireValue(Number.isFinite(value[name]) && value[name] >= 0, `${name} must be a finite number at least 0`);
  }
}

function food(value) {
  recordObject(value, 'Food');
  identifier(value.id, 'Food id');
  identifier(value.name, 'Food name');
  requireValue(value.name === value.name.trim(), 'Food name must be trimmed');
  requireValue(['g', 'ml', 'item', 'scoop'].includes(value.unit), 'Food unit must be g, ml, item or scoop');
  positive(value.baseQty, 'baseQty');
  positive(value.defaultQty, 'defaultQty');
  validateNutrients(value);
  const aliases = value.aliases === undefined ? [] : value.aliases;
  requireValue(Array.isArray(aliases) && aliases.every(alias => typeof alias === 'string'), 'Aliases must be an array of strings');
  return structuredClone({ ...value, aliases });
}

function entry(value) {
  recordObject(value, 'Entry');
  identifier(value.id, 'Entry id');
  date(value.date);
  requireValue(Number.isInteger(value.meal) && value.meal >= 1, 'Meal must be an integer at least 1');
  identifier(value.foodId, 'Entry foodId');
  positive(value.qty, 'qty');
  return structuredClone(value);
}

function weight(value) {
  recordObject(value, 'Weight');
  date(value.date);
  positive(value.kg, 'kg');
  requireValue(value.kg < 500, 'kg must be under 500');
  return structuredClone(value);
}

function settings(value) {
  recordObject(value, 'Settings');
  recordObject(value.goals, 'Settings goals');
  validateNutrients(value.goals);
  return structuredClone({ goals: value.goals });
}

function entries(values) {
  requireValue(Array.isArray(values), 'Entries must be an array');
  return values.map(entry);
}

export function createStore(backend) {
  return {
    async loadAll() {
      const [foods, entries, weights, storedSettings] = await Promise.all(
        Object.keys(keyPaths).map(name => backend.getAll(name)),
      );
      entries.sort((a, b) => a.date.localeCompare(b.date) || a.meal - b.meal);
      weights.sort((a, b) => a.date.localeCompare(b.date));
      const stored = storedSettings.find(record => record.key === 'settings');
      const { key, ...loadedSettings } = stored || {};
      return { foods, entries, weights, settings: stored ? loadedSettings : structuredClone(DEFAULT_SETTINGS) };
    },
    async saveFood(value) { await backend.put('foods', food(value)); },
    async deleteFood(id) {
      const records = await backend.getAll('entries');
      if (records.some(record => record.foodId === id)) throw new Error('Food is used by a diary entry');
      await backend.remove('foods', id);
    },
    async saveEntry(value) { await backend.put('entries', entry(value)); },
    async saveEntries(values) { await backend.putMany('entries', entries(values)); },
    async deleteEntry(id) { await backend.remove('entries', id); },
    async saveWeight(value) { await backend.put('weights', weight(value)); },
    async deleteWeight(value) { await backend.remove('weights', value); },
    async saveSettings(value) { await backend.put('settings', { ...settings(value), key: 'settings' }); },
    async replaceAll(data) {
      recordObject(data, 'Replacement data');
      requireValue(Array.isArray(data.foods), 'Foods must be an array');
      requireValue(Array.isArray(data.weights), 'Weights must be an array');
      const replacement = {
        foods: data.foods.map(food),
        entries: entries(data.entries),
        weights: data.weights.map(weight),
        settings: [{ ...settings(data.settings), key: 'settings' }],
      };
      await backend.replaceAll(replacement);
    },
  };
}
