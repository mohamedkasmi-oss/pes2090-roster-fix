import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import logoAsset from '@/assets/pes2090-logo.jpg.asset.json';
import bgAsset from '@/assets/login-bg.jpg.asset.json';

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
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      dir="rtl"
      style={{
        backgroundImage: `linear-gradient(rgba(7,13,20,0.55), rgba(7,13,20,0.75)), url(${bgAsset.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="neon-glow-green p-8 w-full max-w-md rounded-2xl"
        style={{
          background: 'rgba(10, 20, 30, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '0.5px solid rgba(0, 255, 102, 0.4)',
        }}
      >
        <div className="text-center mb-6">
          <motion.img
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            src={logoAsset.url}
            alt="PES 2090"
            className="w-40 h-40 mx-auto object-contain drop-shadow-[0_0_25px_rgba(0,255,102,0.45)]"
          />
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
            className="w-full btn-neon font-orbitron"
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
