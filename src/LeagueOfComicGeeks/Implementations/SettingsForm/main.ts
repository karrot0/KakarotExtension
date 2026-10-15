import { type CookieStorageInterceptor, Form, type SettingsFormProviding } from "@paperback/types";
import { SettingsForm } from "./form";

export class SettingsFormImplementation implements SettingsFormProviding {
  // Provided by LeagueOfComicGeeksExtension, which this class is mixed into.
  declare cookieStorageInterceptor: CookieStorageInterceptor;

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm(this.cookieStorageInterceptor);
  }
}
