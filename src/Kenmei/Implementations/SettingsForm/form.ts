import {
  ButtonRow,
  Form,
  InputRow,
  LabelRow,
  NavigationRow,
  Section,
} from "@paperback/types";
import { getUserProfile, login } from "../../Services/Requests";
import { clearSession, getSession, setCredentials, setSession } from "../Shared/session";
import type { KenmeiUserProfile } from "../Shared/types";

interface LoginInput {
  email: string;
  password: string;
}

export class LoginForm extends Form {
  loginInput: LoginInput = { email: "", password: "" };

  override requiresExplicitSubmission = true;

  override formWillAppear(): void {
    this.resetFields();
  }

  override formWillDisappear(): void {
    this.resetFields();
  }

  override getSections() {
    return [
      Section(
        {
          id: "login-section",
          header: "Log in to Kenmei",
          footer:
            "Enter your Kenmei email and password. Your credentials are stored securely so your session can be renewed automatically.",
        },
        [
          InputRow("email-input", {
            title: "Email",
            value: this.loginInput.email,
            onValueChange: Application.Selector(this as LoginForm, "onEmailChange"),
          }),
          InputRow("password-input", {
            title: "Password",
            value: this.loginInput.password,
            onValueChange: Application.Selector(this as LoginForm, "onPasswordChange"),
          }),
        ],
      ),
    ];
  }

  async onEmailChange(newValue: string): Promise<void> {
    this.loginInput.email = newValue;
  }

  async onPasswordChange(newValue: string): Promise<void> {
    this.loginInput.password = newValue;
  }

  override async formDidSubmit(): Promise<void> {
    const logPrefix = "[Kenmei:LoginForm:submit]";
    if (!this.loginInput.email || !this.loginInput.password) {
      throw new Error("Please enter your email and password.");
    }

    try {
      const sessionData = await login(this.loginInput.email, this.loginInput.password);
      setSession(sessionData);
      setCredentials(this.loginInput.email, this.loginInput.password);
      console.log(`${logPrefix} login successful - user: ${sessionData.username}`);
    } catch (e) {
      console.log(`${logPrefix} login failed: ${String(e)}`);
      throw new Error(`Login failed: ${String(e)}`);
    }
  }

  resetFields(): void {
    this.loginInput = { email: "", password: "" };
  }
}

export class SettingsForm extends Form {
  private profile: KenmeiUserProfile | null = null;
  private profileLoading = false;

  override formWillAppear(): void {
    const sess = getSession();
    if (sess && !this.profile && !this.profileLoading) {
      this.profileLoading = true;
      getUserProfile(sess.username)
        .then((p) => {
          this.profile = p;
        })
        .catch(() => {
          /* ignore — stats are optional */
        })
        .finally(() => {
          this.profileLoading = false;
          this.reloadForm();
        });
    }
  }

  override getSections() {
    const sess = getSession();
    if (!sess) {
      this.profile = null;
      return this.unauthenticatedView();
    }
    return this.authenticatedView(sess.username);
  }

  unauthenticatedView() {
    return [
      Section({ id: "login-section" }, [
        NavigationRow("login", {
          title: "Log in",
          form: new LoginForm(),
        }),
      ]),
    ];
  }

  authenticatedView(username: string) {
    const sections = [
      Section({ id: "profile-section", header: "Profile" }, [
        LabelRow("username", {
          title: "Logged in as",
          value: username,
        }),
      ]),
    ];

    if (this.profile) {
      const { status, contentType } = this.profile.counts;

      const statusRows = Object.entries(status).map(([label, count], i) =>
        LabelRow(`stat-status-${i}`, { title: label, value: String(count) }),
      );

      const typeRows = Object.entries(contentType).map(([label, count], i) =>
        LabelRow(`stat-type-${i}`, { title: label, value: String(count) }),
      );

      if (statusRows.length > 0) {
        sections.push(Section({ id: "stats-status-section", header: "Library" }, statusRows));
      }
      if (typeRows.length > 0) {
        sections.push(Section({ id: "stats-type-section", header: "Content Types" }, typeRows));
      }
    }

    sections.push(
      Section({ id: "session-section" }, [
        ButtonRow("logout-button", {
          title: "Log out",
          onSelect: Application.Selector(this as SettingsForm, "logOut"),
        }),
      ]),
    );

    return sections;
  }

  async logOut(): Promise<void> {
    clearSession();
    this.reloadForm();
  }
}
