import {
  type CookieStorageInterceptor,
  ButtonRow,
  Form,
  InputRow,
  LabelRow,
  NavigationRow,
  Section,
} from "@paperback/types";
import { login, logout } from "../../Services/Requests";
import { session } from "../Shared/parser/main";

interface LoginInput {
  username: string;
  password: string;
}

export class LoginForm extends Form {
  loginInput: LoginInput = { username: "", password: "" };

  constructor(
    private readonly cookieStore?: CookieStorageInterceptor,
    private readonly onLoggedIn?: () => void,
  ) {
    super();
  }

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
          header: "Log in",
          footer:
            "Use your League of Comic Geeks username and password to log in. Your password is only used for the initial login and is not stored.",
        },
        [
          InputRow("username-input", {
            title: "Username or email",
            value: this.loginInput.username,
            onValueChange: Application.Selector(this as LoginForm, "onUsernameChange"),
          }),
          InputRow("password-input", {
            title: "Password",
            value: this.loginInput.password,
            isSecureEntry: true,
            onValueChange: Application.Selector(this as LoginForm, "onPasswordChange"),
          }),
        ],
      ),
    ];
  }

  async onUsernameChange(newValue: string): Promise<void> {
    this.loginInput.username = newValue;
  }

  async onPasswordChange(newValue: string): Promise<void> {
    this.loginInput.password = newValue;
  }

  override async formDidSubmit(): Promise<void> {
    const logPrefix = "[LoginForm:submit]";
    if (!this.loginInput.username || !this.loginInput.password) {
      throw new Error("Please enter your username and password.");
    }

    try {
      const sessionData = await login(
        this.loginInput.username.trim(),
        this.loginInput.password,
        this.cookieStore,
      );
      session.setSession(sessionData);
      console.log(`${logPrefix} login successful`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`${logPrefix} login failed: ${message}`);
      throw new Error(`Login failed: ${message}`);
    }
    this.onLoggedIn?.();
  }

  resetFields(): void {
    this.loginInput = { username: "", password: "" };
  }
}

export class SettingsForm extends Form {
  constructor(private readonly cookieStore?: CookieStorageInterceptor) {
    super();
  }

  override getSections() {
    const info = session.getSession();
    if (!info) {
      return this.unauthenticatedView();
    }
    return this.authenticatedView(info.username);
  }

  unauthenticatedView() {
    return [
      Section({ id: "login-section" }, [
        NavigationRow("login", {
          title: "Log in",
          form: new LoginForm(this.cookieStore, () => this.reloadForm()),
        }),
      ]),
    ];
  }

  authenticatedView(username: string) {
    return [
      Section({ id: "profile-section", header: "Profile" }, [
        LabelRow("username", {
          title: "Logged in as",
          value: username,
        }),
      ]),
      Section({ id: "session-section" }, [
        ButtonRow("logout-button", {
          title: "Log out",
          onSelect: Application.Selector(this as SettingsForm, "logOut"),
        }),
      ]),
    ];
  }

  async logOut(): Promise<void> {
    try {
      await logout(this.cookieStore);
    } catch (e) {
      console.log(`[SettingsForm:logout] error: ${String(e)}`);
    }
    session.clearSession();
    this.reloadForm();
  }
}
