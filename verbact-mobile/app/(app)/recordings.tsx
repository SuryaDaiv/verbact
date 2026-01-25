import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';
import { Play, Calendar, Clock, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Recording {
    id: string;
    title: string;
    created_at: string;
    duration_seconds?: number; // Optional if not yet implemented in backend
}

export default function Recordings() {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    const fetchRecordings = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('recordings')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRecordings(data || []);
        } catch (error) {
            console.error('Error fetching recordings:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRecordings();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRecordings();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const renderItem = ({ item }: { item: Recording }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => {
                router.push(`/(app)/recording/${item.id}`);
            }}
        >
            <View style={styles.cardIcon}>
                <Play size={20} color={Colors.primary} fill={Colors.primary} />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Untitled Recording'}</Text>
                <View style={styles.cardMeta}>
                    <Calendar size={12} color={Colors.textSecondary} />
                    <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
                    {/* <Clock size={12} color={Colors.textSecondary} style={{ marginLeft: 8 }} />
                    <Text style={styles.metaText}>{formatDuration(item.duration_seconds)}</Text> */}
                </View>
            </View>
            <ChevronRight size={20} color={Colors.border} />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(168, 108, 255, 0.05)', 'transparent']}
                style={styles.headerGradient}
            />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Your Verbact Recordings</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={recordings}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No recordings yet.</Text>
                            <TouchableOpacity onPress={() => router.back()} style={styles.emptyButton}>
                                <Text style={styles.emptyButtonText}>Start Recording</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    headerGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 200,
    },
    header: {
        marginTop: 100, // Space for AppHeader
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.text,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(168, 108, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        opacity: 0.7,
    },
    emptyText: {
        color: Colors.textSecondary,
        fontSize: 16,
        marginBottom: 20,
    },
    emptyButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    emptyButtonText: {
        color: Colors.text,
        fontWeight: '600',
    }
});
