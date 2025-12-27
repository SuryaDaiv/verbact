const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidForegroundService = (config) => {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;
        const mainApplication = androidManifest.manifest.application[0];

        // Check if service already exists
        let services = mainApplication.service || [];
        const serviceName = 'app.notifee.core.ForegroundService';

        const existingService = services.find(
            (s) => s.$['android:name'] === serviceName
        );

        if (!existingService) {
            services.push({
                $: {
                    'android:name': serviceName,
                    'android:foregroundServiceType': 'microphone',
                    'android:exported': 'false', // Usually safe default
                },
            });
            mainApplication.service = services;
        }

        return config;
    });
};

module.exports = withAndroidForegroundService;
