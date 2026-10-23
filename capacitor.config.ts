import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexusai.agent',
  appName: 'NexusAI',
  webDir: 'dist',
  bundledWebRuntime: false,
  // LAN desktop pairing needs HTTP; production remote services should use HTTPS.
  server: { androidScheme: 'http', cleartext: true },
};

export default config;
