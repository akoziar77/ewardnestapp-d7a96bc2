import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ewardnest',
  appName: 'ewardnestapp',
  webDir: 'dist',
  server: {
    url: 'https://3c880b5f-61da-4358-a17e-17073360afdc.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
