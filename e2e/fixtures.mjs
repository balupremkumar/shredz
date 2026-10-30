// Balu's sample foods (mock values) and a seeding helper that writes straight to IndexedDB.
export const FOODS = [
  { id: 'wb', name: 'Weet-Bix', aliases: ['weetbix', 'wheat bix'], unit: 'item', baseQty: 1, defaultQty: 2, kcal: 55, protein: 1.8, carbs: 10.5, fat: 0.3 },
  { id: 'gm', name: 'Green milk', aliases: ['green top milk', 'milk'], unit: 'ml', baseQty: 100, defaultQty: 200, kcal: 46, protein: 3.5, carbs: 5, fat: 1.5 },
  { id: 'wp', name: 'Whey protein', aliases: ['whey', 'protein'], unit: 'scoop', baseQty: 1, defaultQty: 1, kcal: 120, protein: 24, carbs: 3, fat: 1.5 },
  { id: 'cb', name: 'Chicken breast', aliases: ['chicken'], unit: 'g', baseQty: 100, defaultQty: 150, kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'br', name: 'Basmati rice', aliases: ['rice'], unit: 'g', baseQty: 100, defaultQty: 150, kcal: 130, protein: 3, carbs: 28, fat: 0.3 },
  { id: 'cs', name: 'Cashews', aliases: ['cashew', 'cashew nuts'], unit: 'g', baseQty: 100, defaultQty: 20, kcal: 580, protein: 18, carbs: 30, fat: 46 },
];
export const SENTENCE = 'Meal number one, 2 Weet-Bix, green milk 200 mils and one scoop of whey protein. Meal number two, chicken breast 125 grams, basmati rice 150 grams and 20 grams of cashews.';

// Runs in the page after the app has created its database once.
export async function seed(page, { foods = FOODS, entries = [], weights = [] } = {}) {
  await page.evaluate(async ({ foods, entries, weights }) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('macro-diary'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = db.transaction(['foods', 'entries', 'weights'], 'readwrite');
    foods.forEach(f => tx.objectStore('foods').put(f));
    entries.forEach(e => tx.objectStore('entries').put(e));
    weights.forEach(w => tx.objectStore('weights').put(w));
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, { foods, entries, weights });
  await page.reload();
  await page.waitForSelector('.tabbar .tab');
}

export function localDate(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
