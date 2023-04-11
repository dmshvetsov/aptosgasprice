export function getRpcUrl() {
  return import.meta.env.VITE_RPC_URL
}

export function isEnv(env: 'development' | 'production') {
  return import.meta.env.MODE === env;
}
