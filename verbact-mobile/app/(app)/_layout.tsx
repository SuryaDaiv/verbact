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
                    tabBarIcon: ({ color, size }) => <Mic size={size} color={color} />,
                    tabBarLabelStyle: {
                        fontWeight: '700',
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
