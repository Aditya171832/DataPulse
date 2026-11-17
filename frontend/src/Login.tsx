
import { useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  LockKeyhole,
  Mail,
  User,
  Eye,
  EyeOff,
} from "lucide-react";

import { loginUser, registerUser } from "./api";

interface LoginProps {
  onLogin: (
    token: string,
    user: { name: string; email: string; role: string }
  ) => void;
}

function Login({ onLogin }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    resetMessages();

    const normalizedEmail = email.trim().toLowerCase();

    if (isRegister) {
      if (name.trim().length < 2) {
        setError("Name must contain at least 2 characters.");
        return;
      }

      if (password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        const result = await registerUser(
          name.trim(),
          normalizedEmail,
          password
        );

        if (!result?.success) {
          throw new Error(
            result?.message || "Registration failed. Please try again."
          );
        }

        setSuccess(
          "Account created successfully! You can now sign in."
        );

        setIsRegister(false);
        setName("");
        setPassword("");
        setConfirmPassword("");
      } else {
        const result = await loginUser(
          normalizedEmail,
          password
        );

        if (!result?.success || !result?.token || !result?.user) {
          throw new Error(
            result?.message || "Login failed. Please try again."
          );
        }

        localStorage.setItem("datapulse_token", result.token);
        localStorage.setItem(
          "datapulse_user",
          JSON.stringify(result.user)
        );

        onLogin(result.token, result.user);
      }
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: {
            message?: string;
          };
        };
        message?: string;
      };

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to connect to the DataPulse server."
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    resetMessages();
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand-icon">
          <Activity size={30} />
        </div>

        <h1>DataPulse</h1>

        <p className="login-subtitle">
          Intelligent Data Engineering Platform
        </p>

        <h2>
          {isRegister ? "Create your account" : "Welcome back"}
        </h2>

        <p className="login-description">
          {isRegister
            ? "Register to start using your DataPulse workspace."
            : "Sign in to access your workspace."}
        </p>

        {isRegister && (
          <>
            <label htmlFor="register-name">Full name</label>

            <div className="login-input">
              <User size={18} />

              <input
                id="register-name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                minLength={2}
                required
              />
            </div>
          </>
        )}

        <label htmlFor="login-email">Email address</label>

        <div className="login-input">
          <Mail size={18} />

          <input
            id="login-email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <label htmlFor="login-password">Password</label>

        <div className="login-input">
          <LockKeyhole size={18} />

          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder={
              isRegister
                ? "Create a password (minimum 8 characters)"
                : "Enter your password"
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              isRegister ? "new-password" : "current-password"
            }
            minLength={isRegister ? 8 : undefined}
            required
          />

          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {isRegister && (
          <>
            <label htmlFor="confirm-password">
              Confirm password
            </label>

            <div className="login-input">
              <LockKeyhole size={18} />

              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                required
              />
            </div>
          </>
        )}

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="login-success" role="status">
            {success}
          </div>
        )}

        <button
          className="login-submit"
          type="submit"
          disabled={loading}
        >
          {loading
            ? isRegister
              ? "Creating account..."
              : "Signing in..."
            : isRegister
              ? "Create Account"
              : "Sign in"}
        </button>

        <p className="login-switch">
          {isRegister
            ? "Already have an account?"
            : "Don't have an account?"}{" "}

          <button
            type="button"
            onClick={switchMode}
            disabled={loading}
          >
            {isRegister ? "Sign in" : "Create account"}
          </button>
        </p>

        <p className="login-footer">
          Secure access powered by DataPulse
        </p>
      </form>
    </div>
  );
}

export default Login;
