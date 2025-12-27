---
description: Build Android APK locally on Windows (No EAS CLI)
---
1. Generate Native Code (Prebuild)
// turbo
npx expo prebuild --platform android --clean

2. Build APK (Debug)
cd android
./gradlew assembleDebug

3. Locate APK
The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`
Note: This is a debug build. You must UNINSTALL the previous version of the app from your device before installing this one, as the signatures will differ.
