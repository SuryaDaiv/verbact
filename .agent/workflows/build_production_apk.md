---
description: Build Production APK via EAS
---

# Build Production APK

This workflow will build the production APK for Android using Expo Application Services (EAS).
This is required to include the native modules for:
- `expo-blur` (Glassmorphism)
- `expo-linear-gradient` (Gradients)
- `react-native-audio-record` (Audio Capture)

## Prerequisites
- You must be logged in to EAS (`eas login`).
- You must have your Android credentials set to `auto` or configured in `eas.json` (or interactive mode will ask).

## Steps

1. **Clean Project**
   Ensure `node_modules` and cache are clean (optional but recommended).
   ```powershell
   cd m:\verbact\verbact-mobile
   ```

2. **Run EAS Build**
   Run the build command for Android.
   ```powershell
   npx eas build --platform android --profile preview
   ```
   
   - **`--profile preview`**: Generates an **.apk** file (Install directly on phone).
   - **`--profile production`**: Generates an **.aab** file (Upload to Play Store).
   
3. **Wait for Build**
   The build runs in the cloud. It may take 10-20 minutes.
   
4. **Download & Install**
   Once finished, EAS will provide a download link.
   - Download the `.apk` (or `.aab` for Play Store).
   - Install on your device.
   
   > **Note:** You will need to uninstall the development client (or previous version) if signatures differ.

## Troubleshooting
- If build fails on `gradle` errors, verify `android` directory is clean or delete it (if you are using Managed Workflow/Prebuild). 
- Since we are using Expo Router + Native Modules, a "Prebuild" is often done automatically by EAS.
