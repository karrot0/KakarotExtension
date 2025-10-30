import {
  ButtonRow,
  Form,
  FormSectionElement,
  InputRow,
  Section,
  SelectRow,
} from "@paperback/types";
import {
  getExtraArgumentsSetting,
  getLanguageSetting,
  LANGUAGE_OPTIONS,
  getHideReadSetting,
  setHideReadSetting,
  resetNHentaiSettings,
  setExtraArgumentsSetting,
  setLanguageSetting,
} from "./settings";

export class SettingsForm extends Form {
  private languageSetting = getLanguageSetting();
  private extraArguments = getExtraArgumentsSetting();
  private hideRead = getHideReadSetting();

  async updateLanguage(value: string[]): Promise<void> {
    const selected = value?.[0] ?? this.languageSetting;
    this.languageSetting = selected;
    setLanguageSetting(selected);
    this.reloadForm();
  }

  async updateExtraArguments(value: string): Promise<void> {
    this.extraArguments = value;
    setExtraArgumentsSetting(value);
  }

  async updateHideRead(value: string[]): Promise<void> {
    const selected = value?.[0] ?? (this.hideRead ? "on" : "off");
    this.hideRead = selected === "on";
    setHideReadSetting(this.hideRead);
    this.reloadForm();
  }

  async handleReset(): Promise<void> {
    resetNHentaiSettings();
    this.languageSetting = getLanguageSetting();
    this.extraArguments = getExtraArgumentsSetting();
    this.hideRead = getHideReadSetting();
    this.reloadForm();
  }

  override getSections(): FormSectionElement[] {
    return [
      Section("nhentaiSettings", [
        SelectRow("language", {
          title: "Preferred Language",
          subtitle: "Applies to search and homepage queries",
          value: [this.languageSetting],
          options: LANGUAGE_OPTIONS.map((option) => ({
            id: option.id,
            title: option.label,
          })),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as SettingsForm,
            "updateLanguage",
          ),
        }),
        SelectRow("hideRead", {
          title: "Hide Read Entries",
          subtitle: "Filters out manga you've marked as read",
          value: [this.hideRead ? "on" : "off"],
          options: [
            { id: "off", title: "Off" },
            { id: "on", title: "On" },
          ],
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as SettingsForm,
            "updateHideRead",
          ),
        }),
        InputRow("extraArguments", {
          title: "Arguments",
          value: this.extraArguments,
          onValueChange: Application.Selector(
            this as SettingsForm,
            "updateExtraArguments",
          ),
        }),
        ButtonRow("reset", {
          title: "Reset to Defaults",
          onSelect: Application.Selector(this as SettingsForm, "handleReset"),
        }),
      ]),
    ];
  }
}
