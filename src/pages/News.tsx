import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author_team: { name: string; logo_url: string | null } | null;
}

const News = () => {
  const { isAdmin, team } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => { fetchNews(); }, []);

  const fetchNews = async () => {
    const { data } = await supabase
      .from('news')
      .select('*, author_team:teams!news_author_team_id_fkey(name, logo_url)')
      .order('created_at', { ascending: false });
    if (data) setNews(data as unknown as NewsItem[]);
  };

  const postNews = async () => {
    if (!title.trim() || !content.trim() || !team) return;
    await supabase.from('news').insert({ title, content, author_team_id: team.id });
    setTitle('');
    setContent('');
    fetchNews();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-orbitron font-bold text-foreground">📰 الأخبار</h1>

      {isAdmin && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="font-cairo font-semibold text-accent">نشر خبر جديد</h3>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الخبر" className="bg-muted/50 font-cairo" />
          <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="محتوى الخبر" className="bg-muted/50 font-cairo" rows={4} />
          <Button onClick={postNews} disabled={!title.trim() || !content.trim()} className="font-cairo">نشر</Button>
        </div>
      )}

      <div className="space-y-4">
        {news.map(item => (
          <div key={item.id} className="glass-card p-5 space-y-2">
            <div className="flex items-center gap-2">
              {item.author_team?.logo_url && <img src={item.author_team.logo_url} alt="" className="w-5 h-5 object-contain" />}
              <span className="text-xs text-muted-foreground font-cairo">{item.author_team?.name}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString('ar')}</span>
            </div>
            <h3 className="text-lg font-cairo font-bold text-foreground">{item.title}</h3>
            <p className="text-muted-foreground font-cairo text-sm leading-relaxed">{item.content}</p>
          </div>
        ))}
        {news.length === 0 && (
          <p className="text-muted-foreground font-cairo text-center py-8">لا توجد أخبار بعد</p>
        )}
      </div>
    </div>
  );
};

export default News;
