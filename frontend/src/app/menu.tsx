import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../theme';

export default function MenuScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // 1. Determine if we are on a large screen (Desktop/Tablet)
  const isDesktop = width > 768;

  // 2. Dynamically scale fonts based on screen width (e.g., 8% of screen width)
  const dynamicTitleSize = Math.min(width * 0.1, 64); // Caps at 64px max
  const dynamicButtonTextSize = Math.min(width * 0.04, 22); // Caps at 22px max

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      {/* 3. The main wrapper enforces a maxWidth so it doesn't stretch infinitely on PC */}
      <View style={[styles.appWrapper, isDesktop && styles.appWrapperDesktop]}>
        
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: dynamicTitleSize }]}>SA-NQOBA</Text>
          <Text style={styles.tagline}>Conquer the 10 Economic Zones</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Welcome, Commander!</Text>
          <Text style={styles.infoText}>
            The South African economy is in flux. Take control of your starting province, build your armies, and use the Ludo Command Die to outmaneuver the NPC factions. 
            Do you have what it takes to conquer all 10 zones?
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/game' as any)}>
            <Text style={[styles.primaryButtonText, { fontSize: dynamicButtonTextSize }]}>
              🎮 START NEW GAME
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => alert('Rules screen coming soon!')}>
            <Text style={[styles.secondaryButtonText, { fontSize: dynamicButtonTextSize }]}>
              📖 HOW TO PLAY
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => alert('Analytics screen coming soon!')}>
            <Text style={[styles.secondaryButtonText, { fontSize: dynamicButtonTextSize }]}>
              📊 STATISTICS
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>UCT INF4001 Entrance Exam</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: COLORS.skyBlue,
    alignItems: 'center', // Centers the whole app on large screens
  },
  appWrapper: {
    width: '100%',
    padding: 20,
    paddingTop: 60,
  },
  appWrapperDesktop: {
    maxWidth: 800, // Stops the app from stretching beyond 800px on PC
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontWeight: 'bold',
    color: COLORS.charcoal,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    color: COLORS.mossGreen,
    fontWeight: '600',
    marginTop: 5,
  },
  infoBox: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.yellowGreen,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  buttonContainer: {
    gap: 15,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: COLORS.mossGreen,
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: COLORS.oliveGreen,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  footerText: {
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
    color: COLORS.mossGreen,
    fontSize: 12,
    fontWeight: 'bold',
  }
});