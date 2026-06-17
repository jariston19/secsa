import { FormEvent, useState } from "react";
import LoginBackground from "../components/LoginBackground";
import ThemeToggle from "../components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <LoginBackground />
      <div className="login-page-toolbar">
        <ThemeToggle />
      </div>
      <Card className="login-card w-full max-w-[420px] border-white/40 bg-card/80 shadow-2xl backdrop-blur-xl">
        <CardHeader className="items-center space-y-4 text-center">
          <img className="login-logo" src="/logo.png" alt="SECSA" />
          <div className="space-y-2">
            <CardTitle className="text-[1.375rem] tracking-tight">SECSA <br /> Academic Quality Assurance Portal</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Sign in to your account
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit} autoComplete="off">
            <div className="grid gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="off"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
