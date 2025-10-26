import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import headerLogo from '@/assets/swingsense-header.png';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast({
              title: 'Account exists',
              description: 'An account with this email already exists. Please sign in instead.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Sign up failed',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Success!',
            description: 'Please check your email to confirm your account.',
          });
          setIsSignUp(false);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Invalid credentials',
              description: 'Please check your email and password.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Sign in failed',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Welcome back!',
            description: 'Successfully signed in.',
          });
          navigate('/');
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black flex flex-col items-center justify-center p-4">
      {/* Back button */}
      <div className="absolute top-6 left-6">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-white/80 hover:text-emerald-400 transition-colors font-medium text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Logo and Subtitle */}
      <div className="flex flex-col items-center mb-8">
        <img
          src={headerLogo}
          alt="SwingSense"
          className="h-12 w-auto drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-[glowpulse_7s_ease-in-out_infinite] mb-3"
        />
        <p className="text-white/60 text-sm font-medium">Smarter swings start here.</p>
      </div>

      {/* Auth Form Card */}
      <div className="w-[90%] max-w-sm rounded-2xl bg-white/5 border border-white/10 p-6 shadow-[0_0_25px_rgba(16,185,129,0.15)] backdrop-blur-md">
        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            className={`flex-1 py-2.5 rounded-lg font-black text-sm transition-all ${
              !isSignUp
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`flex-1 py-2.5 rounded-lg font-black text-sm transition-all ${
              isSignUp
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-white/60 text-sm text-center mb-6">
          {isSignUp 
            ? 'Create your account to start analyzing your swing' 
            : 'Welcome back! Sign in to access your analysis'
          }
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-white font-medium text-sm">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={isSignUp}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white font-medium text-sm">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white font-medium text-sm">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>
          
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-black text-base h-12 rounded-xl border-0 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </Button>
        </form>

        {/* Footer text */}
        <div className="mt-6 text-center">
          <p className="text-white/60 text-sm">
            {isSignUp 
              ? 'Already have an account? ' 
              : "Don't have an account? "
            }
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>

      {/* Bottom helper text */}
      <p className="text-white/40 text-xs text-center mt-6 max-w-xs">
        By signing up, you agree to our Terms of Service and Privacy Policy.
      </p>

      <style>{`
        @keyframes glowpulse {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.6));
          }
        }
      `}</style>
    </div>
  );
};

export default Auth;