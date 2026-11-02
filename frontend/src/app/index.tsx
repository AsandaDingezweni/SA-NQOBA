import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../theme';

export default function SplashScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions(); 

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/menu');
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  
  const responsiveFontSize = width < 400 ? 14 : 18;

  return (
    <View style={styles.container}>
      <Image 
        source={require('../../assets/images/sanqoba.jpeg')}
        style={styles.backgroundImage}
        resizeMode="contain"
      />
      <Text style={[styles.loadingText, { fontSize: responsiveFontSize }]}>
        Loading the battlefield...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.charcoal,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    height: '100%',
  },
  loadingText: {
    position: 'absolute',
    bottom: '10%', // Uses percentage so it stays near the bottom on all screens
    color: COLORS.white,
    fontStyle: 'italic',
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.6)', 
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  }
});