import { defineConfig, loadEnv } from 'vite';

// Supabase key checks: only a publishable or anon key may reach the browser.
function isPublicKey(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) return false;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    return payload.role === 'anon';
  } catch {
    return false;
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), ['SUPABASE_', 'DEMO_']);
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  let config = null;
  if (url || key) {
    let endpoint;
    try {
      endpoint = new URL(url);
    } catch {
      throw new Error('Set SUPABASE_URL to a valid Supabase project URL.');
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
    if ((endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:')) ||
        endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
      throw new Error('Use the Supabase project origin for SUPABASE_URL. HTTP is supported on loopback only.');
    }
    if (!isPublicKey(key || '')) {
      throw new Error('Set SUPABASE_PUBLISHABLE_KEY to a publishable or legacy anon key.');
    }
    config = { url: endpoint.origin, key };
  }

  // Test mode (role switcher, skip approval, fast timers) is ON for `npm run dev` and
  // `npm run build:demo`, and OFF for `npm run build`. DEMO_TEST_MODE=0/1 overrides.
  const testMode = env.DEMO_TEST_MODE ? env.DEMO_TEST_MODE === '1' : (command === 'serve' || mode === 'demo');

  // A production build must talk to the real backend. Without keys it would quietly
  // fall back to sample data, where anyone can sign in as a sample seller by email.
  if (command === 'build' && !testMode && !config && env.DEMO_ALLOW_SAMPLE !== '1') {
    throw new Error('Production build needs SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Use `npm run build:demo` for the sample demo.');
  }

  return {
    base: './',
    envPrefix: [],
    define: {
      __MARKETPLACE_CONFIG__: JSON.stringify(config),
      __TEST_MODE__: JSON.stringify(testMode),
    },
  };
});
