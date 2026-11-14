import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/layout/AuthCard";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters").max(60, "Keep it under 60 characters"),
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up | TrafficSense AI" },
      { name: "description", content: "Create a free TrafficSense AI account to report traffic incidents and confirm road conditions." },
      { property: "og:title", content: "Sign up | TrafficSense AI" },
      { property: "og:description", content: "Join the community explaining Bengaluru's traffic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string | undefined>>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/map", replace: true });
  }, [user, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ name: f.name?.[0], email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: window.location.origin, data: { display_name: parsed.data.name } },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created!");
      navigate({ to: "/map" });
    } else setSentTo(parsed.data.email);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email" subtitle={`We sent a confirmation link to ${sentTo}.`} footer={<Link to="/login" className="font-semibold text-teal hover:underline">Back to log in</Link>}>
        <div className="flex flex-col items-center gap-3 rounded-xl bg-teal/10 p-6 text-center">
          <MailCheck className="h-10 w-10 text-teal" />
          <p className="text-sm">Click the link in the email to activate your account, then log in to start reporting.</p>
        </div>
      </AuthCard>
    );
  }

  const field = (key: keyof typeof form, label: string, type: string, auto: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        autoComplete={auto}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        aria-invalid={!!errors[key]}
        className="h-11 rounded-xl"
      />
      {errors[key] && <p className="text-xs font-medium text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <AuthCard
      title="Create your account"
      subtitle="Report incidents and help commuters understand the traffic."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-teal hover:underline">Log in</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {field("name", "Display name", "text", "nickname")}
        {field("email", "Email", "email", "email")}
        {field("password", "Password", "password", "new-password")}
        <Button type="submit" variant="teal" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Sign up
        </Button>
      </form>
    </AuthCard>
  );
}
