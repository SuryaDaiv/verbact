import { Stack } from 'expo-router';
import { AuthProvider } from '../lib/AuthProvider';
import { Colors } from '../constants/Colors';
import { AppHeader } from '../components/ui/AppHeader';
import { StatusBar } from 'expo-status-bar';
import '../lib/foregroundService'; // Register foreground service

export default function RootLayout() {
    return (
        <AuthProvider>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: {
                        backgroundColor: Colors.background,
                    },
                }}
            >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="(app)" options={{ headerShown: false }} />
            </Stack>
        </AuthProvider >
    );
}
