import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Lock, Gamepad2 } from 'lucide-react';

const Login = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(code);
    if (!result.success) {
      setError(result.error || 'خطأ في تسجيل الدخول');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="glass-card-strong neon-glow-green p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center"
          >
            <Gamepad2 className="w-10 h-10 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-orbitron font-bold text-primary neon-text-green">
            PES 2090
          </h1>
          <p className="text-muted-foreground mt-2 font-cairo">عالم كرة القدم الافتراضي</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="أدخل رمز الفريق..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="pr-10 bg-muted/50 border-border/50 text-foreground placeholder:text-muted-foreground text-center font-orbitron tracking-widest"
              dir="ltr"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-destructive text-sm text-center"
            >
              {error}
            </motion.p>
          )}

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-orbitron"
            disabled={isLoading || !code}
          >
            {isLoading ? '...' : 'دخول'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
