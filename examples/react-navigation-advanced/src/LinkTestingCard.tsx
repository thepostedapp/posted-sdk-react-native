import { Platform, Text, View } from "react-native";

import { styles } from "./styles";

type LinkTestingCardProps = {
  title: string;
};

// Shared testing guide rendered by the onboarding screen and every main tab,
// so the instructions stay identical everywhere. The Posted link is shown once
// up top because both the Deferred and Universal / App flows use it.
export function LinkTestingCard({ title }: LinkTestingCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        Add credentials from the posted-sdk panel to <Text style={styles.accent}>.env</Text> before
        testing.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.sectionHeader}>Posted link</Text>
      <Text style={styles.code}>https://&lt;org&gt;.posted.link/&lt;hash&gt;/details</Text>

      <Text style={styles.sectionHeader}>Deferred Link</Text>
      <Text style={styles.bullet}>
        Uninstall the app, open a Posted link in the mobile browser, then reinstall and launch. Sign
        in and complete onboarding — React Navigation replays the link once it can reach{" "}
        <Text style={styles.accent}>Details</Text>.
      </Text>

      <Text style={styles.sectionHeader}>Universal / App Link</Text>
      <Text style={styles.bullet}>
        With the app installed, trigger the Posted link. You can do it by visiting it in the
        browser, pasting and tapping it in Notes / Messages app or using a terminal command.
      </Text>

      <Text style={styles.sectionHeader}>Custom Scheme</Text>
      <Text style={styles.bullet}>
        A custom-scheme URL launches the app and is routed by React Navigation:
      </Text>
      <Text style={styles.code}>
        npx uri-scheme open {`"posted-react-navigation-advanced://details"`}{" "}
        {Platform.OS === "android" ? "--android" : "--ios"}
      </Text>
    </View>
  );
}
