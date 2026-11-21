// Legacy local-storage compatibility helpers. New records are stored in Supabase.
const STORAGE_KEY = 'ali-hub-data';
export function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
export function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch (error) { console.error('Local backup failed:', error); return false; }
}