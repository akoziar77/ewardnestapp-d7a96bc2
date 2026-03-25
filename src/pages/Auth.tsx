import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bird, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import SignUpFields from "@/components/auth/SignUpFields";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem("remembered_email") ?? "");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("remembered_email"));
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      if (rememberMe) {
        localStorage.setItem("remembered_email", email.trim());
      } else {
        localStorage.removeItem("remembered_email");
      }

      if (isSignUp) {
        const dob = dobYear && dobMonth && dobDay
          ? `${dobYear}-${dobMonth}-${dobDay}`
          : undefined;

        const { error, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || undefined,
              first_name: firstName.trim() || undefined,
              last_name: lastName.trim() || undefined,
              address: address.trim() || undefined,
              city: city.trim() || undefined,
              state: state.trim() || undefined,
              zip_code: zipCode.trim() || undefined,
              date_of_birth: dob,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast({ title: "Account created!", description: "Check your email to confirm." });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Bird className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-balance text-center text-2xl font-bold tracking-tight leading-tight">
            {isSignUp ? "Create your nest" : "Welcome back"}
          </h1>
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp
              ? "Start collecting rewards across all your favorite merchants"
              : "Sign in to check your rewards"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <SignUpFields
              firstName={firstName} setFirstName={setFirstName}
              lastName={lastName} setLastName={setLastName}
              address={address} setAddress={setAddress}
              city={city} setCity={setCity}
              state={state} setState={setState}
              zipCode={zipCode} setZipCode={setZipCode}
              dobMonth={dobMonth} setDobMonth={setDobMonth}
              dobDay={dobDay} setDobDay={setDobDay}
              dobYear={dobYear} setDobYear={setDobYear}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="h-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-opacity hover:opacity-70"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {!isSignUp && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Remember me
                </Label>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!email.trim()) {
                    toast({ title: "Enter your email first", variant: "destructive" });
                    return;
                  }
                  setLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setLoading(false);
                  if (error) {
                    toast({ title: "Error", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: "Check your email", description: "We sent a password reset link." });
                  }
                }}
                className="text-xs font-medium text-primary hover:underline underline-offset-4"
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button
            type="submit"
            className="h-12 w-full text-base font-semibold active:scale-[0.97] transition-transform"
            disabled={loading}
          >
            {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-12 w-full gap-3 text-sm font-medium active:scale-[0.97] transition-transform"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (result?.error) {
                toast({
                  title: "Error",
                  description: result.error.message || "Google sign-in failed",
                  variant: "destructive",
                });
                setLoading(false);
              }
              if (!result?.redirected) {
                setLoading(false);
              }
            } catch (err: any) {
              toast({
                title: "Error",
                description: err.message || "Google sign-in failed",
                variant: "destructive",
              });
              setLoading(false);
            }
          }}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-12 w-full gap-3 text-sm font-medium active:scale-[0.97] transition-transform"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const result = await lovable.auth.signInWithOAuth("apple", {
                redirect_uri: window.location.origin,
              });
              if (result?.error) {
                toast({
                  title: "Error",
                  description: result.error.message || "Apple sign-in failed",
                  variant: "destructive",
                });
                setLoading(false);
              }
              if (!result?.redirected) {
                setLoading(false);
              }
            } catch (err: any) {
              toast({
                title: "Error",
                description: err.message || "Apple sign-in failed",
                variant: "destructive",
              });
              setLoading(false);
            }
          }}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Continue with Apple
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
