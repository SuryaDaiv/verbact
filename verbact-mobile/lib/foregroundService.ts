import notifee from '@notifee/react-native';

// Register the foreground service to avoid warnings and ensure stability
notifee.registerForegroundService((notification) => {
    return new Promise(() => {
        // Long running task...
        // The service will stop when stopForegroundService is called
    });
});
