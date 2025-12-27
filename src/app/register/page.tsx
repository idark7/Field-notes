"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    };

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Registration failed");
      return;
    }

    router.push("/editor");
  }

  return (
    <main className="page-shell flex min-h-[calc(100vh-73px)] items-center justify-center py-16">
      <div className="section-card w-full max-w-xl p-8 md:p-10 mx-auto">
        <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Create your account
        </h2>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          Share your travel essays and multimedia stories.
        </p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <input
            type="text"
            name="name"
            placeholder="Name"
            required
            className="border rounded-lg px-4 py-3"
            style={{ borderColor: 'var(--border-gray)', background: 'var(--bg-white)', color: 'var(--text-primary)' }}
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="border rounded-lg px-4 py-3"
            style={{ borderColor: 'var(--border-gray)', background: 'var(--bg-white)', color: 'var(--text-primary)' }}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="border rounded-lg px-4 py-3"
            style={{ borderColor: 'var(--border-gray)', background: 'var(--bg-white)', color: 'var(--text-primary)' }}
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            disabled={loading}
            className="text-white px-4 py-3 rounded-lg text-sm font-semibold transition hover:opacity-90"
            style={{ background: 'var(--button-primary)' }}
          >
            {loading ? "Creating..." : "Register"}
          </button>
        </form>
      </div>
    </main>
  );
}
