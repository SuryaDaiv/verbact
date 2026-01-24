import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image, Dimensions } from 'react-native';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/Colors';
import { Stack, useRouter } from 'expo-router';
import { Mic, ArrowRight } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function signInWithGoogle() {
        setLoading(true);
        try {
            let redirectUrl = Linking.createURL('/auth/callback');
            if (redirectUrl.includes('verbact:///')) {
                redirectUrl = redirectUrl.replace('verbact:///', 'verbact://');
            }

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true
                }
            });

            if (error) throw error;
            if (!data?.url) throw new Error("No URL returned from Supabase");

            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

            if (result.type === 'success' && result.url) {
                const params = new URLSearchParams(result.url.split('#')[1]);
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');

                if (access_token && refresh_token) {
                    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                    if (error) throw error;
                    router.replace('/(app)/record');
                }
            }
        } catch (e: any) {
            Alert.alert("Google Login Failed", e.message);
        } finally {
            setLoading(false);
        }
    }

    async function signInWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            Alert.alert('Sign In Failed', error.message);
            setLoading(false);
        } else {
            router.replace('/(app)/record');
        }
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Background Gradient */}
            <LinearGradient
                colors={['#1a1025', '#0E0E12', '#000000']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <LinearGradient
                            colors={Colors.gradients.primary as any}
                            style={styles.logoGradient}
                        >
                            <Mic size={32} color="white" />
                        </LinearGradient>
                    </View>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to continue creator journey</Text>
                </View>

                <View style={styles.form}>
                    {/* Google Button */}
                    <TouchableOpacity
                        style={styles.googleButton}
                        onPress={signInWithGoogle}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color={Colors.text} />
                        ) : (
                            <>
                                {/* <Image source={require('../../assets/google-icon.png')} style={styles.googleIcon} /> */}
                                <Text style={styles.googleButtonText}>Continue with Google</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            onChangeText={setEmail}
                            value={email}
                            placeholder="Email address"
                            placeholderTextColor={Colors.textSecondary}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <TextInput
                            style={styles.input}
                            onChangeText={setPassword}
                            value={password}
                            secureTextEntry={true}
                            placeholder="Password"
                            placeholderTextColor={Colors.textSecondary}
                            autoCapitalize="none"
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.signInButton}
                        onPress={signInWithEmail}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary as any}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.signInGradient}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <View style={styles.signInContent}>
                                    <Text style={styles.signInText}>Sign In</Text>
                                    <ArrowRight size={20} color="white" />
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoContainer: {
        marginBottom: 24,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    logoGradient: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: 'center',
        opacity: 0.8,
    },
    form: {
        gap: 20,
    },
    googleButton: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    googleButtonText: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: 10,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    dividerText: {
        color: Colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    inputGroup: {
        gap: 12,
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 18,
        color: Colors.text,
        fontSize: 16,
    },
    signInButton: {
        marginTop: 10,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    signInGradient: {
        padding: 18,
        alignItems: 'center',
    },
    signInContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    signInText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    }
});
