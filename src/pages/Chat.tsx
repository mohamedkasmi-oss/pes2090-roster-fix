import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, ImagePlus } from 'lucide-react';

interface ChatMessage {
  id: string;
  team_id: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
  team: { name: string; logo_url: string | null; coach_name: string } | null;
}

const Chat = () => {
  const { team } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, team:teams!chat_messages_team_id_fkey(name, logo_url, coach_name)')
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) setMessages(data as unknown as ChatMessage[]);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !team) return;
    await supabase.from('chat_messages').insert({ team_id: team.id, message: newMsg.trim() });
    setNewMsg('');
  };

  const uploadImage = async (file: File) => {
    if (!team) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-images').upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
      await supabase.from('chat_messages').insert({ team_id: team.id, image_url: urlData.publicUrl });
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-2xl font-orbitron font-bold text-foreground mb-4">💬 الدردشة</h1>

      <div className="flex-1 glass-card p-4 overflow-y-auto space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.team_id === team?.id ? 'flex-row-reverse' : ''}`}
          >
            <img src={msg.team?.logo_url || ''} alt="" className="w-8 h-8 rounded-full object-contain flex-shrink-0 mt-1" />
            <div className={`max-w-[70%] ${msg.team_id === team?.id ? 'items-end' : ''}`}>
              <p className="text-xs text-muted-foreground font-cairo mb-1">
                {msg.team?.coach_name} ({msg.team?.name})
              </p>
              <div className={`glass-card p-3 ${msg.team_id === team?.id ? 'bg-primary/10 border-primary/30' : ''}`}>
                {msg.message && <p className="font-cairo text-sm">{msg.message}</p>}
                {msg.image_url && <img src={msg.image_url} alt="" className="max-w-full rounded-lg mt-1" />}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 mt-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])}
          />
          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <ImagePlus className="w-5 h-5" />
          </div>
        </label>
        <Input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="اكتب رسالة..."
          className="bg-muted/50 font-cairo"
          disabled={uploading}
        />
        <Button onClick={sendMessage} disabled={!newMsg.trim() || uploading} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default Chat;
