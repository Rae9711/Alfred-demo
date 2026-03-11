import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'Alfred.app',
  appName: 'Alfred',
  webDir: 'www',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: true
  },
  server: {
    // Allow loading from any origin for API calls
    allowNavigation: ['*']
  }
};

export default config;