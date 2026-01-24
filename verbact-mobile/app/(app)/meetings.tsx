
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Calendar } from 'lucide-react-native';

export default function Meetings() {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Calendar size={64} color={Colors.primary} style={{ opacity: 0.5, marginBottom: 20 }} />
                <Text style={styles.title}>Meetings</Text>
                <Text style={styles.subtitle}>Calendar integration coming soon.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
    }
});
