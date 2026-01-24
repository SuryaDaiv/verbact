
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';
import { User, CreditCard, Clock, LogOut, Shield } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const API_BASE_URL = 'https://api.verbact.com';

export default function Profile() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [usage, setUsage] = useState<any>(null);
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [])
    );

    const fetchProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // 1. Get User Profile
            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                // PGRST116 is "Row not found" - maybe profile hasn't been created yet
                console.error('Error fetching profile:', error);
            }

            setProfile({
                email: session.user.email,
                ...profileData
            });

            // 2. Get Usage Stats
            console.log('Fetching usage stats from:', `${API_BASE_URL}/api/user/usage`);
            const response = await fetch(`${API_BASE_URL}/api/user/usage?token=${session.access_token}`);

            if (response.ok) {
                const data = await response.json();
                console.log('Usage data received:', data);
                setUsage(data);
            } else {
                const errorText = await response.text();
                console.error('Failed to fetch usage:', response.status, errorText);
            }

        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                Alert.alert('Error', error.message);
            }
            // Explicitly redirect to the landing page after sign out
            router.replace('/');
        } catch (err: any) {
            console.error("Sign out error:", err);
            Alert.alert('Error', "Failed to sign out");
        }
    };

    const formatTime = (seconds: any) => {
        if (seconds === undefined || seconds === null || isNaN(seconds)) return "0m";
        if (seconds === -1) return "Unlimited";
        const mins = Math.floor(seconds / 60);
        const hrs = Math.floor(mins / 60);
        if (hrs > 0) return `${hrs}h ${mins % 60}m`;
        return `${mins}m`;
    };

    const handleUpgrade = () => {
        // Since in-app purchase is hard, we can redirect to web for now
        Alert.alert("Upgrade Plan", "Please visit our website to upgrade your plan.");
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <View style={styles.content}>

                {/* User Card */}
                <View style={styles.card}>
                    <View style={styles.avatar}>
                        <User size={32} color={Colors.primary} />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.email}>{profile?.email}</Text>
                        <Text style={styles.tierBadge}>
                            {(usage?.tier || 'Free').toUpperCase()} Plan
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
                        <Text style={styles.upgradeText}>Upgrade</Text>
                    </TouchableOpacity>
                </View>

                {/* Usage Stats */}
                <Text style={styles.sectionTitle}>Usage & Billing</Text>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Clock size={20} color={Colors.primary} style={{ marginBottom: 8 }} />
                        <Text style={styles.statValue}>{usage ? formatTime(usage.remaining_seconds) : '--'}</Text>
                        <Text style={styles.statLabel}>Remaining</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Shield size={20} color={Colors.textSecondary} style={{ marginBottom: 8 }} />
                        <Text style={styles.statValue}>{usage ? formatTime(usage.limit_seconds) : '--'}</Text>
                        <Text style={styles.statLabel}>Monthly Limit</Text>
                    </View>
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Minutes Used</Text>
                        <Text style={styles.infoValue}>{usage ? formatTime(usage.used_seconds) : '--'}</Text>
                    </View>
                    <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.infoLabel}>Next Renewal</Text>
                        <Text style={styles.infoValue}>
                            {usage?.next_renewal ? new Date(usage.next_renewal).toDateString() : '--'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                    <LogOut size={20} color="#FF4444" />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        marginTop: 60,
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.text,
    },
    content: {
        paddingHorizontal: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: 20,
        borderRadius: 16,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(168, 108, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    userInfo: {
        flex: 1,
    },
    email: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    tierBadge: {
        color: Colors.primary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },
    upgradeBtn: {
        backgroundColor: 'rgba(168, 108, 255, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    upgradeText: {
        color: Colors.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    sectionTitle: {
        color: Colors.textSecondary,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    statValue: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        color: Colors.textSecondary,
        fontSize: 12,
    },
    infoCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        paddingHorizontal: 20,
        marginBottom: 32,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    infoLabel: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    infoValue: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '500',
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 68, 68, 0.2)',
        backgroundColor: 'rgba(255, 68, 68, 0.05)',
    },
    signOutText: {
        color: '#FF4444',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    }
});
