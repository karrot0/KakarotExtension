import { Form, type SettingsFormProviding } from "@paperback/types";
import { SettingsForm } from "./form";

export class SettingsFormImplementation implements SettingsFormProviding {
  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }
}
