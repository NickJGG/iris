import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

const storage: SupportedStorage = {
  async getItem(key) {
    const items = await browser.storage.local.get(key);
    return (items[key] as string | undefined) ?? null;
  },
  async setItem(key, value) {
    await browser.storage.local.set({ [key]: value });
  },
  async removeItem(key) {
    await browser.storage.local.remove(key);
  },
};

let client: SupabaseClient | undefined;

/** Lazy so a missing .env surfaces as a request error instead of killing the background script. */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!__SUPABASE_URL__ || !__SUPABASE_ANON_KEY__) {
      throw new Error('Iris is not configured: set SUPABASE_URL and SUPABASE_ANON_KEY in .env and rebuild (see SETUP.md)');
    }
    client = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'implicit',
      },
    });
  }
  return client;
}
