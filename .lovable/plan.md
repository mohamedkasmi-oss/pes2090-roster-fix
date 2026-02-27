

# PES 2090 Universe — Implementation Plan

## 1. Setup Lovable Cloud Backend
- Create database tables: `teams`, `matches`, `news`, `chat_messages`, `challenges`, `app_settings`
- Enable RLS policies for all tables
- Create storage bucket for chat image uploads
- Seed the **16 correct teams** with exact names, coaches, access codes, and logo URLs

## 2. Authentication System (Access Code Login)
- Login page where coaches enter their team access code
- No email/password — just code-based entry
- Store logged-in team in app state
- **Ban system**: If team `is_suspended = true`, show full red screen blocking access

## 3. Admin Panel (KAS2026 Only)
- **League Generator**: Fetch all 16 teams, generate 30-round double round-robin (Berger algorithm), save all matches
- **Cup Generator**: 
  - Round of 16: randomly pair 16 teams into 8 matches
  - Quarter-finals, Semi-finals, Final: pull winners from previous round
- **UCL Groups**: Shuffle 16 teams into 4 groups (A–D), generate group stage matches
- **Score Input**: Admin can enter match scores on the scoreboard
- **Team Suspension**: Toggle ban status for any team

## 4. Main Pages & UI

### Homepage / Dashboard
- Header with Messi (blonde) & Ronaldo (Madrid) images
- Live scoreboard showing recent/upcoming matches
- League standings table (points, wins, draws, losses, GD)

### League Page
- Full standings table sorted by points
- Match results by round

### Cup Page
- Bracket view showing R16 → QF → SF → Final progression

### UCL Page
- Group tables (A, B, C, D) with standings
- Group match results

### Chat Room
- Real-time team chat
- Image upload support (Supabase storage)
- Messages show team logo + coach name

### News Page
- Admin can post news/announcements
- AI Journalist: auto-generate match reports from scores
- AI Analyst: match predictions based on team stats

## 5. Design Theme
- **Dark glass/glassmorphism** theme throughout
- Semi-transparent cards with blur backdrop
- Neon accent colors
- Arabic text support (RTL where needed)
- Team logos displayed prominently everywhere

## 6. Challenges System
- Coaches can challenge other teams to matches
- Accept/decline mechanic
- Results tracked separately from tournaments

