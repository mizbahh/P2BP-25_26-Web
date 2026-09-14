import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { sanitizeReturnUrl } from "../routes/sanitizeReturnUrl";

export function Login() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = sanitizeReturnUrl(searchParams.get("returnUrl"));

  const [isSignup, setIsSignup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    if (isAuthenticated) navigate(returnUrl ?? "/projects", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await login(email, password);
      if (!resp.Success) {
        setError(resp.Message ?? "Login failed");
        return;
      }
      navigate(returnUrl ?? "/projects", { replace: true });
    } catch {
      setError("Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await register(firstName, lastName, email, password);
      if (!resp.Success) {
        setError(resp.Message ?? "Signup failed");
        return;
      }
      setIsSignup(false);
      setInfo("Account created. Check your email to verify it before logging in.");
    } catch {
      setError("Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-neutral-900">
          {isSignup ? "Create your account" : "Sign in to BetterPlacemaking"}
        </h1>

        {info && <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{info}</p>}
        {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {isSignup ? (
          <form className="space-y-4" onSubmit={submitSignup}>
            <Field label="First name" value={firstName} onChange={setFirstName} required />
            <Field label="Last name" value={lastName} onChange={setLastName} required />
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <Field label="Password" type="password" value={password} onChange={setPassword} required />
            <SubmitButton submitting={submitting} label="Sign up" />
          </form>
        ) : (
          <form className="space-y-4" onSubmit={submitLogin}>
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <Field label="Password" type="password" value={password} onChange={setPassword} required />
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <SubmitButton submitting={submitting} label="Sign in" />
          </form>
        )}

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-neutral-600 hover:underline"
          onClick={() => {
            setError(null);
            setInfo(null);
            setIsSignup((v) => !v);
          }}
        >
          {isSignup ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>

      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

function SubmitButton({ submitting, label }: { submitting: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
    >
      {submitting ? "Please wait…" : label}
    </button>
  );
}
