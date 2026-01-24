import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback, Image } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, LogOut, ListMusic, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/AuthProvider';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export function AppHeader() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { session } = useAuth();
    const [menuVisible, setMenuVisible] = useState(false);

    const [tier, setTier] = React.useState('Free Tier');

    React.useEffect(() => {
        if (!session) return;
        const fetchProfile = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('subscription_tier')
                .eq('id', session.user.id)
                .single();
            if (data?.subscription_tier) {
                setTier(data.subscription_tier.charAt(0).toUpperCase() + data.subscription_tier.slice(1) + (data.subscription_tier === 'pro' ? '' : ' Tier'));
            }
        };
        fetchProfile();
    }, [session]);

    const handleLogout = async () => {
        setMenuVisible(false);
        await supabase.auth.signOut();
        router.replace('/login');
    };

    const handleLogoPress = () => {
        if (session) {
            router.push('/(app)/record');
        } else {
            router.replace('/');
        }
    };

    return (
        <>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.blurBackground} />

                <View style={styles.content}>
                    {/* Left: Placeholder or Back button (empty for now) */}
                    <View style={styles.sideContainer}>
                        {/* Could put back button here if needed */}
                    </View>

                    {/* Center: Logo/Brand */}
                    <TouchableOpacity onPress={handleLogoPress} style={styles.center} activeOpacity={0.7}>
                        <Image
                            source={require('../../assets/images/logo.png')}
                            style={{ width: 28, height: 28, marginRight: 8 }}
                            resizeMode="contain"
                        />
                        <Text style={styles.brandText}>Verbact</Text>
                    </TouchableOpacity>

                    {/* Right: User Menu */}
                    <View style={[styles.sideContainer, { alignItems: 'flex-end' }]}>
                        {session ? (
                            <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.profileButton} activeOpacity={0.7}>
                                <View style={styles.avatarCircle}>
                                    <User size={20} color={Colors.text} />
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginBtn}>
                                <Text style={styles.loginText}>Login</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* Custom Modal Menu */}
            <Modal
                visible={menuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.menuContainer, { marginTop: insets.top + 60 }]}>
                                <View style={styles.menuHeader}>
                                    <Text style={styles.menuEmail} numberOfLines={1}>{session?.user.email}</Text>
                                    <View style={styles.planBadge}>
                                        <Text style={styles.planText}>{tier}</Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/(app)/recordings'); }}>
                                    <ListMusic size={20} color={Colors.text} />
                                    <Text style={styles.menuItemText}>My Recordings</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                                    <LogOut size={20} color={Colors.error} />
                                    <Text style={[styles.menuItemText, { color: Colors.error }]}>Logout</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    blurBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.headerBackground,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    content: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    sideContainer: {
        flex: 1, // Take up equal space on sides
    },
    center: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 2, // Give more space to center if needed
    },
    logoBadge: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor: Colors.primary,
    },
    logoText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 20,
    },
    brandText: {
        color: Colors.text,
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    profileButton: {
        padding: 4,
    },
    avatarCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    loginBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    loginText: {
        color: Colors.text,
        fontWeight: '600',
        fontSize: 14,
    },
    // Menu Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
    },
    menuContainer: {
        width: 250,
        backgroundColor: '#1A1D24',
        borderRadius: 16,
        marginRight: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    menuHeader: {
        padding: 12,
    },
    menuEmail: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    planBadge: {
        backgroundColor: 'rgba(168, 108, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
        borderRadius: 6,
    },
    planText: {
        color: Colors.primary,
        fontSize: 11,
        fontWeight: 'bold',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginVertical: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 8,
    },
    menuItemText: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '500',
    }
});
