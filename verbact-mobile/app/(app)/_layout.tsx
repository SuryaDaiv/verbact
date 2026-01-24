import { Tabs } from 'expo-router';
import { View, Platform, Image } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Mic, List, Calendar, User } from 'lucide-react-native';

export default function AppLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: Colors.surface,
                    borderTopColor: Colors.border,
                    height: Platform.OS === 'ios' ? 88 : 68,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
                    paddingTop: 12,
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textSecondary,
                tabBarShowLabel: true,
                tabBarItemStyle: {
                    flexDirection: 'column-reverse', // Label on top, Icon on bottom
                    height: Platform.OS === 'ios' ? 60 : 54, // Adjust height for better fit
                    paddingBottom: 4,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    marginBottom: 2, // Space between label and icon
                    marginTop: 0,
                }
            }}
        >
            <Tabs.Screen
                name="recordings"
                options={{
                    title: 'Recordings',
                    tabBarIcon: ({ color, size }) => <List size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="meetings"
                options={{
                    title: 'Meetings',
                    tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
                }}
            />

            <Tabs.Screen
                name="record"
                options={{
                    title: 'Record',
                    tabBarIcon: ({ focused }) => (
                        <View style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: Colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: -20, // Pop out effect (adjusted for inverted layout)
                            borderWidth: 4,
                            borderColor: Colors.background,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 4,
                            elevation: 5,
                        }}>
                            <Image
                                source={require('../../assets/images/logo.png')}
                                style={{ width: 40, height: 40 }}
                                resizeMode="contain"
                            />
                        </View>
                    ),
                    tabBarLabelStyle: {
                        color: Colors.primary, // Always primary color for the main action
                        fontWeight: '700',
                        marginBottom: 28 // Push label up to clear the popped-out button
                    }
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
                }}
            />

            {/* Hidden Routes */}
            <Tabs.Screen
                name="recording/[id]"
                options={{
                    href: null, // Hide from tab bar
                    tabBarStyle: { display: 'none' } // Hide tab bar when viewing recording details
                }}
            />
        </Tabs>
    );
}
