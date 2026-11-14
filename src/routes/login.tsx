import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/layout/AuthCard";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(1, "Enter your password"),
});

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in | TrafficSense AI" },
      { name: "description", content: "Log in to TrafficSense AI to report incidents and confirm traffic conditions." },
      { property: "og:title", content: "Log in | TrafficSense AI" },
      { property: "og:description", content: "Log in to report and confirm traffic incidents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | undefined; password?: string | undefined }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/map", replace: true });
  }, [user, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Email or password is incorrect" : error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/map" });
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to report incidents and confirm what's on the road."
      footer={<>New here? <Link to="/signup" className="font-semibold text-teal hover:underline">Create an account</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} className="h-11 rounded-xl" />
          {errors.email && <p className="text-xs font-medium text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} className="h-11 rounded-xl" />
          {errors.password && <p className="text-xs font-medium text-destructive">{errors.password}</p>}
        </div>
        <Button type="submit" variant="teal" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Log in
        </Button>
      </form>
    </AuthCard>
  );
}
