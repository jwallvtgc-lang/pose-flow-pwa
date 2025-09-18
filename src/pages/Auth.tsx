import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-sp-royal-blue hover:text-sp-blue transition-colors font-anton uppercase text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to SwingSense
          </Link>
        </div>

        <Card className="border-4 border-black rounded-2xl shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-anton font-black uppercase tracking-wide">
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </CardTitle>
            <CardDescription className="text-lg font-bold">
              {isSignUp 
                ? 'Create your SwingSense account to start analyzing your swing' 
                : 'Welcome back! Sign in to access your swing analysis'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="font-bold text-lg">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isSignUp}
                    className="border-2 border-gray-300 rounded-xl h-12 text-lg"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="font-bold text-lg">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-2 border-gray-300 rounded-xl h-12 text-lg"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="font-bold text-lg">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-2 border-gray-300 rounded-xl h-12 text-lg"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-sp-royal-blue hover:bg-sp-blue text-white font-anton font-black uppercase text-xl h-14 rounded-xl border-2 border-black shadow-lg"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  isSignUp ? 'Sign Up' : 'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-bold text-lg text-sp-royal-blue hover:text-sp-blue transition-colors"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in' 
                  : "Don't have an account? Sign up"
                }
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;