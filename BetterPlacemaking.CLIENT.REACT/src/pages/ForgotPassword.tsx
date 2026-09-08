import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../lib/env";

const GENERIC_MESSAGE = "If an account exists for that email, a password reset link has been sent.";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${API_BASE_URL}/api/password/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      // Deliberately identical message on success or failure - avoids leaking whether an email exists.
      setSubmitting(false);
      setMessage(GENERIC_MESSAGE);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-neutral-900">Reset your password</h1>

        {message ? (
          <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium text-neutral-700">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link to="/login" className="mt-4 block text-center text-sm text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
