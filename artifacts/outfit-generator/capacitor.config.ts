import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalhandbags.app',
  appName: 'My Handbags',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  ios: {
    // Allow the WKWebView to scroll; the app manages its own scroll areas
    scrollEnabled: true,
    // Prevents white flash on launch
    backgroundColor: '#3C0812',
    // Allow inline media playback (used for wardrobe image previews)
    allowsInlineMediaPlayback: true,
    // iOS permission usage descriptions (also set in Info.plist for safety)
    infoPlist: {
      NSCameraUsageDescription:
        'My Handbags uses your camera so you can photograph handbags and add them to your collection.',
      NSPhotoLibraryUsageDescription:
        'My Handbags reads your photo library so you can choose handbag photos to add to your collection.',
      NSPhotoLibraryAddUsageDescription:
        'My Handbags saves captured photos to your library so you can reuse them later.',
    },
  },

  plugins: {
    // Keep the splash screen visible until the React app signals it is ready
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#F4D6DD',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },

    // Overlay the status bar so the cream background shows through the notch
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F4D6DD',
      overlaysWebView: true,
    },
  },
};

export default config;
