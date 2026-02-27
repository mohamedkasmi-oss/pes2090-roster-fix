import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Ban } from 'lucide-react';

const Suspended = () => {
  const { team, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-destructive/20 p-4" dir="rtl">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-24 h-24 mx-auto rounded-full bg-destructive/30 flex items-center justify-center animate-pulse">
          <Ban className="w-12 h-12 text-destructive" />
        </div>
        <h1 className="text-4xl font-orbitron font-bold text-destructive">محظور</h1>
        <p className="text-foreground/80 text-lg font-cairo">
          تم إيقاف فريق <strong>{team?.name}</strong> من المشاركة.
        </p>
        <p className="text-muted-foreground font-cairo">تواصل مع الإدارة لمزيد من المعلومات.</p>
        <Button onClick={logout} variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
};

export default Suspended;
