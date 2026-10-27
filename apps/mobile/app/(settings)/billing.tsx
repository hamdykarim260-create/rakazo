import type { BillingStatus } from "@rakazo/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, AppState, Linking, ScrollView } from "react-native";
import { SettingsGroup, SettingsRow } from "../../components/settings-group";
import { rpc } from "../../lib/api";
import { dateLocaleForUi, useI18n } from "../../lib/i18n";
import { useSideInsets } from "../../lib/side-insets";

export default function BillingScreen() {
  const sideInsets = useSideInsets();
  const { t } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [pending, setPending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = () => {
        void rpc("billing/status")
          .then((next) => {
            if (active) setStatus(next);
          })
          .catch(() => {
            if (active) Alert.alert(t("Could not load billing"));
          });
      };
      load();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") load();
      });
      return () => {
        active = false;
        subscription.remove();
      };
    }, [t]),
  );

  async function action(work: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    try {
      await work();
    } catch {
      Alert.alert(t("Could not update billing"));
    } finally {
      setPending(false);
    }
  }

  const freeUntil = status?.byokFreeUntil
    ? new Date(status.byokFreeUntil).toLocaleDateString(dateLocaleForUi(), {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <ScrollView style={sideInsets} contentInsetAdjustmentBehavior="automatic">
      {freeUntil ? (
        <SettingsGroup label={t("Your subscription or API key")}>
          <SettingsRow title={t("Free plan ends")} value={freeUntil} />
        </SettingsGroup>
      ) : (
        <SettingsGroup
          label={t("Your subscription or API key")}
          footer={
            status?.byokPriceCents
              ? t("{price} / month. Works with your ChatGPT or Claude plan.", {
                  price: `$${status.byokPriceCents / 100}`,
                })
              : t("Free. Works with your ChatGPT or Claude plan.")
          }
        >
          <SettingsRow
            title={
              status?.byokPriceCents && status?.trialAvailable
                ? t("Start {days}-day free trial", { days: status.trialDays })
                : t("Use my subscription or API key")
            }
            disabled={pending}
            onPress={() =>
              void action(async () => {
                const result = await rpc("billing/selectFunding", { funding: "byok" });
                if (result.url) await Linking.openURL(result.url);
                else router.replace("/models");
              })
            }
          />
        </SettingsGroup>
      )}
    </ScrollView>
  );
}
