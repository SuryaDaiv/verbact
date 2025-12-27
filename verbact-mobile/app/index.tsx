import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ImageBackground, Dimensions, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthProvider';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientText } from '../components/ui/GradientText';
import { ArrowRight, Mic, FileText, Zap, ChevronRight } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function LandingPage() {
    const { session, loading } = useAuth();
    const router = useRouter();

    const handleStart = () => {
        if (session) {
            router.push('/(app)/dashboard');
        } else {
            router.push('/login');
        }
    };

    const handlePricing = () => {
        Linking.openURL('https://verbact.com/pricing');
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.badge}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.badgeText}>LIVE NOW</Text>
                    </View>

                    <Text style={styles.title}>
                        Real-Time Transcription{'\n'}
                        <GradientText>Done Right.</GradientText>
                    </Text>

                    <Text style={styles.subtitle}>
                        Fast, accurate, distraction-free transcription for meetings, calls, and conversations. No clutter, just clarity.
                    </Text>

                    <View style={styles.heroButtons}>
                        <TouchableOpacity onPress={handleStart} activeOpacity={0.8}>
                            <LinearGradient
                                colors={['#FF512F', '#DD2476'] as const}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.primaryButton}
                            >
                                <Text style={styles.primaryButtonText}>Start Recording Free</Text>
                                <ArrowRight size={20} color="white" />
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handlePricing} style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>View Pricing</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Demo Card (Mock UI) */}
                <LinearGradient
                    colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                    style={styles.demoCard}
                >
                    <View style={styles.demoHeader}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.demoHeaderText}>LIVE SESSION</Text>
                        <Text style={styles.demoTime}>00:14</Text>
                    </View>
                    <View style={styles.demoContent}>
                        <View style={styles.demoLine}>
                            <Text style={styles.demoTimestamp}>0:02</Text>
                            <Text style={styles.demoText}>Welcome to Verbact. This is how a clean transcript looks.</Text>
                        </View>
                        <View style={styles.demoLineActive}>
                            <View style={styles.activeIndicator} />
                            <Text style={styles.demoTimestampActive}>0:08</Text>
                            <Text style={styles.demoTextActive}>It highlights the active segment subtly, without distraction.</Text>
                        </View>
                        <View style={styles.demoLine}>
                            <Text style={styles.demoTimestamp}>0:14</Text>
                            <Text style={styles.demoText}>Everything is designed for readable speed.</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Features Grid */}
                <View style={styles.featuresGrid}>
                    <FeatureCard
                        icon={<Mic size={24} color={Colors.coral} />}
                        title="Live Transcription"
                        desc="Instant, low-latency speech-to-text powered by advanced AI models."
                        color="rgba(255, 111, 97, 0.1)"
                    />
                    <FeatureCard
                        icon={<FileText size={24} color={Colors.orange} />}
                        title="Clean Notes"
                        desc="Auto-generated summaries and key moments, formatted for quick review."
                        color="rgba(255, 181, 90, 0.1)"
                    />
                    <FeatureCard
                        icon={<Zap size={24} color={Colors.primary} />}
                        title="Lightning Fast"
                        desc="Optimized for performance. No bloat, no lag, just instant results."
                        color="rgba(168, 108, 255, 0.1)"
                    />
                </View>

                {/* Footer CTA */}
                <LinearGradient
                    colors={['rgba(168, 108, 255, 0.1)', 'transparent']}
                    style={styles.footer}
                >
                    <View style={[styles.iconCircle, { backgroundColor: 'rgba(168, 108, 255, 0.2)' }]}>
                        <Zap size={24} color={Colors.primary} />
                    </View>
                    <Text style={styles.footerTitle}>AI Meeting Assistant Coming Soon</Text>
                    <Text style={styles.footerDesc}>
                        Verbact will soon join your meetings automatically to generate smart notes and action items.
                    </Text>
                    <TouchableOpacity onPress={handlePricing} style={styles.linkButton}>
                        <Text style={styles.linkText}>LEARN MORE</Text>
                        <ArrowRight size={16} color={Colors.primary} />
                    </TouchableOpacity>
                </LinearGradient>

            </ScrollView>
        </View>
    );
}

function FeatureCard({ icon, title, desc, color }: any) {
    return (
        <View style={styles.featureCard}>
            <View style={[styles.iconCircle, { backgroundColor: color }]}>
                {icon}
            </View>
            <Text style={styles.featureTitle}>{title}</Text>
            <Text style={styles.featureDesc}>{desc}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingTop: 80,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    recordingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.error,
        marginRight: 8,
    },
    badgeText: {
        color: Colors.textSecondary,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    title: {
        textAlign: 'center',
        fontSize: 40,
        fontWeight: '700',
        color: Colors.text,
        lineHeight: 48,
        marginBottom: 16,
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 16,
        color: Colors.textSecondary,
        lineHeight: 24,
        maxWidth: 320,
        marginBottom: 32,
    },
    heroButtons: {
        flexDirection: 'row',
        gap: 16,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 30,
        gap: 8,
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    secondaryButton: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    secondaryButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    demoCard: {
        width: '100%',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        marginBottom: 40,
    },
    demoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    demoHeaderText: {
        color: Colors.textSecondary,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        flex: 1,
    },
    demoTime: {
        color: Colors.textSecondary,
        fontSize: 12,
        fontFamily: 'monospace',
    },
    demoContent: {
        padding: 20,
    },
    demoLine: {
        flexDirection: 'row',
        marginBottom: 16,
        opacity: 0.6,
    },
    demoLineActive: {
        flexDirection: 'row',
        marginBottom: 16,
        position: 'relative',
    },
    activeIndicator: {
        position: 'absolute',
        left: -20,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: Colors.primary,
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    demoTimestamp: {
        width: 40,
        fontSize: 12,
        color: Colors.textSecondary,
        paddingTop: 2,
        fontFamily: 'monospace',
    },
    demoTimestampActive: {
        width: 40,
        fontSize: 12,
        color: Colors.primary,
        paddingTop: 2,
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    demoText: {
        flex: 1,
        color: Colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    demoTextActive: {
        flex: 1,
        color: Colors.text,
        fontSize: 15,
        fontWeight: '500',
        lineHeight: 22,
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 40,
    },
    featureCard: {
        width: (width - 40 - 12) / 2, // 2 column roughly
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        minHeight: 180,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    featureTitle: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    featureDesc: {
        color: Colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
    },
    footer: {
        alignItems: 'center',
        padding: 32,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(168, 108, 255, 0.2)',
        marginBottom: 40,
    },
    footerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    footerDesc: {
        color: Colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    linkText: {
        color: Colors.primary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    }
});
