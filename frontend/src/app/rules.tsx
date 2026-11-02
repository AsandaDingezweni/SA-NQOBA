import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button, Card, SectionTitle } from '@/components/ui';
import { COLORS } from '@/constants/theme';

const SOLDIER_TABLE = [
  ['Up to 5 million', 1], ['Up to 10 million', 2], ['Up to 25 million', 3], ['Up to 50 million', 4], ['Up to 75 million', 5],
  ['Up to 100 million', 6], ['Up to 125 million', 7], ['Up to 150 million', 8], ['More than 150 million', 9],
] as const;

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: 'Setup',
    points: [
      'Pick any nation from the world list. Nine rival nations are drawn at random, each run by an NPC.',
      'Every nation starts with soldiers based on its real population (table below).',
      'The turn order is shuffled at random.',
    ],
  },
  {
    title: 'Your turn',
    points: [
      'From round 2, you receive 2 soldiers for every country you hold (at least 2). Deploy them however you like.',
      'You may make one attack per turn, against any country: geography does not matter.',
      'Before or after your attack, you may transfer soldiers between your own countries. Each must keep at least 1.',
      'Or skip attacking and end your turn.',
    ],
  },
  {
    title: 'Battles',
    points: [
      'You need at least 2 soldiers to attack. One soldier always stays home, so you fight with your soldiers minus one.',
      'Each roll, both sides roll the same number of dice: the smaller of (attackers − 1) and defenders.',
      'Dice are paired in order: die 1 vs die 1, die 2 vs die 2. The higher die wins and the lower side loses a soldier. A tie kills nobody.',
      'Keep rolling until the defender has no soldiers (conquered), you are down to 1 soldier (failed), or you stop (which ends your turn).',
      'Conquering a country grants max(2, its soldier value ÷ 2) soldiers there, and you choose how many extra soldiers to move in.',
    ],
  },
  {
    title: 'Winning',
    points: [
      'A player who loses every country is eliminated and skipped from then on.',
      'Conquer all 10 nations to win. Lose all of yours and the campaign is over.',
    ],
  },
  {
    title: 'Rivals, AI and sharing',
    points: [
      'NPCs play to win: they weigh the exact odds of every possible attack and explain each decision in the war room log.',
      'Personalities: 🔥 Aggressive, ⚖️ Balanced, 🛡️ Defensive. With the 🧠 AI strategist on, GPT-4o-mini picks their moves.',
      'An AI commentator calls every dice roll, South African radio style.',
      'Turn on ⏩ Fast-forward to speed up NPC turns; every move is still shown.',
      'Share your game link: anyone can watch live, but only you can play your turns.',
      'Replay any finished or ongoing game step by step from the campaigns list.',
    ],
  },
];

export default function RulesScreen() {
  const router = useRouter();
  return (
    <Screen title="How to play" maxWidth={820}>
      {SECTIONS.map((s) => (
        <Card key={s.title} style={{ gap: 8 }}>
          <SectionTitle>{s.title}</SectionTitle>
          {s.points.map((p) => (
            <Text key={p} style={styles.point}>• {p}</Text>
          ))}
        </Card>
      ))}
      <Card style={{ gap: 8 }}>
        <SectionTitle>Population → soldiers</SectionTitle>
        {SOLDIER_TABLE.map(([pop, n]) => (
          <View key={pop} style={styles.tableRow}>
            <Text style={styles.cell}>{pop}</Text>
            <Text style={[styles.cell, styles.num]}>{n}</Text>
          </View>
        ))}
      </Card>
      <Button title="🎮 Start a campaign" onPress={() => router.push('/new-game')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  point: { color: COLORS.ink, fontSize: 15, lineHeight: 22 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 6 },
  cell: { color: COLORS.ink, fontSize: 14 },
  num: { fontWeight: '900', color: COLORS.mossGreen },
});
