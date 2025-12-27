import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';

interface GradientTextProps extends TextProps {
    colors?: string[];
}

export function GradientText(props: GradientTextProps) {
    const { style, colors = Colors.gradients.primary, ...rest } = props;

    return (
        <MaskedView maskElement={<Text {...rest} style={[style, { opacity: 1 }]} />}>
            <LinearGradient
                colors={Colors.gradients.brand as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <Text {...rest} style={[style, { opacity: 0 }]} />
            </LinearGradient>
        </MaskedView>
    );
}
