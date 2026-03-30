import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  setDoc, 
  orderBy, 
  limit,
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format, startOfToday, subDays, isSameDay, parseISO } from 'date-fns';
import { 
  Activity, 
  Utensils, 
  Scale, 
  Calendar, 
  User as UserIcon, 
  Plus, 
  Trash2, 
  TrendingUp, 
  MessageSquare, 
  LogOut, 
  ChevronRight,
  Heart,
  Droplets,
  Settings,
  BrainCircuit,
  Quote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { db, auth, signInWithGoogle, logOut } from './firebase';
import { 
  UserProfile, 
  DietLog, 
  ExerciseLog, 
  WeightLog, 
  MenstrualLog 
} from './types';
import { MOTIVATIONAL_QUOTES } from './constants';
import { getAICoachResponse } from './services/aiService';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error handling for Firestore
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'trends' | 'coach' | 'profile'>('dashboard');
  const [dietLogs, setDietLogs] = useState<DietLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [menstrualLogs, setMenstrualLogs] = useState<MenstrualLog[]>([]);
  const [dailyQuote, setDailyQuote] = useState("");
  const [coachMessages, setCoachMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isCoachLoading, setIsCoachLoading] = useState(false);

  // Connection test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Profile
  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}`;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
      } else {
        // Create initial profile
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || 'User',
          email: user.email || '',
          createdAt: new Date().toISOString()
        };
        setDoc(doc(db, 'users', user.uid), newProfile).catch(e => handleFirestoreError(e, OperationType.WRITE, path));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, path));
    return () => unsubscribe();
  }, [user]);

  // Fetch Logs
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const dietQ = query(collection(db, 'dietLogs'), where('uid', '==', user.uid), orderBy('date', 'desc'), limit(50));
    const exerciseQ = query(collection(db, 'exerciseLogs'), where('uid', '==', user.uid), orderBy('date', 'desc'), limit(50));
    const weightQ = query(collection(db, 'weightLogs'), where('uid', '==', user.uid), orderBy('date', 'desc'), limit(50));
    const menstrualQ = query(collection(db, 'menstrualLogs'), where('uid', '==', user.uid), orderBy('date', 'desc'), limit(50));

    const unsubDiet = onSnapshot(dietQ, (s) => setDietLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as DietLog))), (e) => handleFirestoreError(e, OperationType.LIST, 'dietLogs'));
    const unsubExercise = onSnapshot(exerciseQ, (s) => setExerciseLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as ExerciseLog))), (e) => handleFirestoreError(e, OperationType.LIST, 'exerciseLogs'));
    const unsubWeight = onSnapshot(weightQ, (s) => setWeightLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as WeightLog))), (e) => handleFirestoreError(e, OperationType.LIST, 'weightLogs'));
    const unsubMenstrual = onSnapshot(menstrualQ, (s) => setMenstrualLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as MenstrualLog))), (e) => handleFirestoreError(e, OperationType.LIST, 'menstrualLogs'));

    return () => {
      unsubDiet();
      unsubExercise();
      unsubWeight();
      unsubMenstrual();
    };
  }, [user, isAuthReady]);

  // Daily Quote
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const seed = today.split('-').reduce((acc, val) => acc + parseInt(val), 0);
    setDailyQuote(MOTIVATIONAL_QUOTES[seed % MOTIVATIONAL_QUOTES.length]);
  }, []);

  const handleCoachChat = async (message: string) => {
    if (!message.trim()) return;
    const newMessages = [...coachMessages, { role: 'user' as const, text: message }];
    setCoachMessages(newMessages);
    setIsCoachLoading(true);
    try {
      const response = await getAICoachResponse(profile, { dietLogs, exerciseLogs, weightLogs }, message);
      setCoachMessages([...newMessages, { role: 'ai' as const, text: response }]);
    } catch (error) {
      console.error("AI Coach Error:", error);
    } finally {
      setIsCoachLoading(false);
    }
  };

  if (!isAuthReady) return <div className="flex items-center justify-center h-screen bg-[#F5F2ED]"><div className="animate-pulse text-2xl font-serif italic">ZEN...</div></div>;

  if (!user) return <LoginView />;

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans pb-24">
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-40 border-b border-[#1A1A1A]/10">
        <h1 className="text-3xl font-serif italic tracking-tight">ZEN</h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveTab('coach')}
            className={cn(
              "p-2 rounded-full transition-all",
              activeTab === 'coach' ? "bg-[#1A1A1A] text-white" : "bg-white text-[#1A1A1A] border border-gray-100"
            )}
          >
            <BrainCircuit size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#1A1A1A]/20"
          >
            <img src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100`} alt="Profile" referrerPolicy="no-referrer" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <DashboardView key="dash" profile={profile} dietLogs={dietLogs} exerciseLogs={exerciseLogs} weightLogs={weightLogs} dailyQuote={dailyQuote} />}
          {activeTab === 'logs' && <LogsView key="logs" dietLogs={dietLogs} exerciseLogs={exerciseLogs} weightLogs={weightLogs} menstrualLogs={menstrualLogs} />}
          {activeTab === 'trends' && <TrendsView key="trends" weightLogs={weightLogs} dietLogs={dietLogs} exerciseLogs={exerciseLogs} />}
          {activeTab === 'coach' && (
            <CoachView 
              key="coach" 
              coachMessages={coachMessages} 
              isCoachLoading={isCoachLoading} 
              onSendMessage={handleCoachChat} 
            />
          )}
          {activeTab === 'profile' && <ProfileView key="profile" profile={profile} user={user} />}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-[#1A1A1A]/10 px-6 py-4 flex justify-around items-center z-50">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={24} />} label="Home" />
        <NavButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<Plus size={24} />} label="Logs" />
        <NavButton active={activeTab === 'coach'} onClick={() => setActiveTab('coach')} icon={<BrainCircuit size={24} />} label="Coach" />
        <NavButton active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} icon={<TrendingUp size={24} />} label="Trends" />
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon size={24} />} label="Me" />
      </nav>

    </div>
  );
}

function CoachView({ coachMessages, isCoachLoading, onSendMessage }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm"
    >
      <div className="p-6 border-b bg-gray-50/50 flex items-center gap-3">
        <BrainCircuit className="text-[#1A1A1A]" />
        <h2 className="text-xl font-serif italic">ZEN AI Coach</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {coachMessages.length === 0 && (
          <div className="text-center py-12 text-gray-500 italic">
            "Hello! I'm your ZEN coach. Ask me anything about your diet, exercise, or health goals."
          </div>
        )}
        {coachMessages.map((m: any, i: number) => (
          <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] p-4 rounded-2xl shadow-sm",
              m.role === 'user' ? "bg-[#1A1A1A] text-white rounded-tr-none" : "bg-[#F5F2ED] text-[#1A1A1A] rounded-tl-none"
            )}>
              <div className="prose prose-sm prose-invert">
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isCoachLoading && (
          <div className="flex justify-start">
            <div className="bg-[#F5F2ED] p-4 rounded-2xl rounded-tl-none animate-pulse flex gap-2">
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t bg-white">
        <form onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
          onSendMessage(input.value);
          input.value = '';
        }} className="flex gap-2">
          <input 
            name="message"
            placeholder="Ask your coach..."
            autoComplete="off"
            className="flex-1 p-4 rounded-xl bg-[#F5F2ED] border-none focus:ring-2 focus:ring-[#1A1A1A] transition-all"
          />
          <button type="submit" className="p-4 bg-[#1A1A1A] text-white rounded-xl hover:scale-105 transition-transform">
            <MessageSquare size={20} />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all", active ? "text-[#1A1A1A] scale-110" : "text-gray-400")}>
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-widest">{label}</span>
    </button>
  );
}

function LoginView() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F5F2ED] p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-8"
      >
        <h1 className="text-6xl font-serif italic tracking-tighter">ZEN</h1>
        <p className="text-gray-500 max-w-xs mx-auto">Your holistic journey to wellness starts here. Track, analyze, and grow.</p>
        <button 
          onClick={signInWithGoogle}
          className="w-full max-w-xs py-4 px-8 bg-[#1A1A1A] text-white rounded-full font-medium flex items-center justify-center gap-3 hover:shadow-xl transition-all"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>
      </motion.div>
    </div>
  );
}

function DashboardView({ profile, dietLogs, exerciseLogs, weightLogs, dailyQuote }: any) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDiet = dietLogs.filter((l: any) => l.date === today);
  const todayExercise = exerciseLogs.filter((l: any) => l.date === today);
  const currentWeight = weightLogs[0]?.weight || profile?.weight || '--';

  const caloriesIn = todayDiet.reduce((acc: number, l: any) => acc + l.calories, 0);
  const caloriesOut = todayExercise.reduce((acc: number, l: any) => acc + l.caloriesBurned, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Quote Card */}
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#1A1A1A]/5 relative overflow-hidden group">
        <Quote className="absolute -top-4 -right-4 w-24 h-24 text-[#F5F2ED] group-hover:text-[#E6E0D4] transition-colors" />
        <div className="relative z-10 space-y-4">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">Daily Wisdom</span>
          <p className="text-2xl font-serif italic leading-relaxed">"{dailyQuote}"</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          icon={<Utensils className="text-orange-500" />} 
          label="Calories In" 
          value={caloriesIn} 
          unit="kcal" 
          color="bg-orange-50"
        />
        <StatCard 
          icon={<Activity className="text-blue-500" />} 
          label="Calories Out" 
          value={caloriesOut} 
          unit="kcal" 
          color="bg-blue-50"
        />
        <StatCard 
          icon={<Scale className="text-emerald-500" />} 
          label="Current Weight" 
          value={currentWeight} 
          unit="kg" 
          color="bg-emerald-50"
        />
        <StatCard 
          icon={<Heart className="text-rose-500" />} 
          label="Net Balance" 
          value={caloriesIn - caloriesOut} 
          unit="kcal" 
          color="bg-rose-50"
        />
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 px-2">Today's Activity</h3>
        <div className="bg-white rounded-[32px] p-2 divide-y divide-gray-50">
          {[...todayDiet, ...todayExercise].length === 0 ? (
            <div className="p-8 text-center text-gray-400 italic">No logs for today yet.</div>
          ) : (
            [...todayDiet, ...todayExercise].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((log: any, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-2xl", log.mealType ? "bg-orange-50 text-orange-500" : "bg-blue-50 text-blue-500")}>
                    {log.mealType ? <Utensils size={18} /> : <Activity size={18} />}
                  </div>
                  <div>
                    <p className="font-medium">{log.foodName || log.activityType}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{log.mealType || `${log.duration} mins`}</p>
                  </div>
                </div>
                <span className="font-mono font-medium">{log.calories || log.caloriesBurned} kcal</span>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon, label, value, unit, color }: any) {
  return (
    <div className="bg-white p-6 rounded-[32px] border border-[#1A1A1A]/5 shadow-sm space-y-4">
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-mono font-bold">{value}</span>
          <span className="text-xs text-gray-400">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function LogsView({ dietLogs, exerciseLogs, weightLogs, menstrualLogs }: any) {
  const [activeLogTab, setActiveLogTab] = useState<'diet' | 'exercise' | 'weight' | 'menstrual'>('diet');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const timestamp = new Date().toISOString();
      const date = format(new Date(), 'yyyy-MM-dd');

      if (activeLogTab === 'diet') {
        await addDoc(collection(db, 'dietLogs'), {
          uid, date, timestamp,
          mealType: data.mealType,
          foodName: data.foodName,
          calories: Number(data.calories)
        });
      } else if (activeLogTab === 'exercise') {
        await addDoc(collection(db, 'exerciseLogs'), {
          uid, date, timestamp,
          activityType: data.activityType,
          duration: Number(data.duration),
          caloriesBurned: Number(data.caloriesBurned)
        });
      } else if (activeLogTab === 'weight') {
        await addDoc(collection(db, 'weightLogs'), {
          uid, date: data.date || date, timestamp,
          weight: Number(data.weight)
        });
      } else if (activeLogTab === 'menstrual') {
        await addDoc(collection(db, 'menstrualLogs'), {
          uid, date: data.date || date, timestamp,
          flow: data.flow,
          notes: data.notes
        });
      }
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, activeLogTab + 'Logs');
    }
  };

  const deleteLog = async (id: string, collectionName: string) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, collectionName);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <TabButton active={activeLogTab === 'diet'} onClick={() => setActiveLogTab('diet')} label="Diet" />
        <TabButton active={activeLogTab === 'exercise'} onClick={() => setActiveLogTab('exercise')} label="Exercise" />
        <TabButton active={activeLogTab === 'weight'} onClick={() => setActiveLogTab('weight')} label="Weight" />
        <TabButton active={activeLogTab === 'menstrual'} onClick={() => setActiveLogTab('menstrual')} label="Cycle" />
      </div>

      <button 
        onClick={() => setIsAdding(true)}
        className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[0.98] transition-transform"
      >
        <Plus size={20} /> Add New {activeLogTab.charAt(0).toUpperCase() + activeLogTab.slice(1)}
      </button>

      <div className="space-y-4">
        {activeLogTab === 'diet' && dietLogs.map((log: any) => (
          <LogItem key={log.id} log={log} onDelete={() => deleteLog(log.id, 'dietLogs')} icon={<Utensils size={16} />} title={log.foodName} subtitle={`${log.mealType} • ${log.date}`} value={`${log.calories} kcal`} />
        ))}
        {activeLogTab === 'exercise' && exerciseLogs.map((log: any) => (
          <LogItem key={log.id} log={log} onDelete={() => deleteLog(log.id, 'exerciseLogs')} icon={<Activity size={16} />} title={log.activityType} subtitle={`${log.duration} mins • ${log.date}`} value={`${log.caloriesBurned} kcal`} />
        ))}
        {activeLogTab === 'weight' && weightLogs.map((log: any) => (
          <LogItem key={log.id} log={log} onDelete={() => deleteLog(log.id, 'weightLogs')} icon={<Scale size={16} />} title="Weight Entry" subtitle={log.date} value={`${log.weight} kg`} />
        ))}
        {activeLogTab === 'menstrual' && menstrualLogs.map((log: any) => (
          <LogItem key={log.id} log={log} onDelete={() => deleteLog(log.id, 'menstrualLogs')} icon={<Droplets size={16} />} title="Cycle Entry" subtitle={log.date} value={log.flow || 'Logged'} />
        ))}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif italic">Add {activeLogTab}</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 bg-gray-100 rounded-full"><Plus className="rotate-45" /></button>
              </div>
              <form onSubmit={handleAddLog} className="space-y-4">
                {activeLogTab === 'diet' && (
                  <>
                    <select name="mealType" className="w-full p-4 rounded-xl bg-gray-50 border-none">
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="dinner">Dinner</option>
                      <option value="snack">Snack</option>
                    </select>
                    <input name="foodName" placeholder="Food Name" required className="w-full p-4 rounded-xl bg-gray-50 border-none" />
                    <input name="calories" type="number" placeholder="Calories" required className="w-full p-4 rounded-xl bg-gray-50 border-none" />
                  </>
                )}
                {activeLogTab === 'exercise' && (
                  <>
                    <input name="activityType" placeholder="Activity Type" required className="w-full p-4 rounded-xl bg-gray-50 border-none" />
                    <input name="duration" type="number" placeholder="Duration (mins)" required className="w-full p-4 rounded-xl bg-gray-50 border-none" />
                    <input name="caloriesBurned" type="number" placeholder="Calories Burned" required className="w-full p-4 rounded-xl bg-gray-50 border-none" />
                  </>
                )}
                {activeLogTab === 'weight' && (
                  <>
                    <input name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} className="w-full p-4 rounded-xl bg-gray-50 border-none" />
                    <input name="weight" type="number" step="0.1" placeholder="Weight (kg)" required className="w-full p-4 rounded-xl bg-gray-50 border-none" />
                  </>
                )}
                {activeLogTab === 'menstrual' && (
                  <>
                    <input name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} className="w-full p-4 rounded-xl bg-gray-50 border-none" />
                    <select name="flow" className="w-full p-4 rounded-xl bg-gray-50 border-none">
                      <option value="light">Light</option>
                      <option value="medium">Medium</option>
                      <option value="heavy">Heavy</option>
                      <option value="spotting">Spotting</option>
                    </select>
                    <textarea name="notes" placeholder="Notes" className="w-full p-4 rounded-xl bg-gray-50 border-none" />
                  </>
                )}
                <button type="submit" className="w-full py-4 bg-[#1A1A1A] text-white rounded-xl font-bold">Save Entry</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TabButton({ active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
        active ? "bg-[#1A1A1A] text-white" : "bg-white text-gray-400 border border-gray-100"
      )}
    >
      {label}
    </button>
  );
}

function LogItem({ log, onDelete, icon, title, subtitle, value }: any) {
  return (
    <div className="bg-white p-4 rounded-2xl flex items-center justify-between group">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#F5F2ED] rounded-xl text-[#1A1A1A]">{icon}</div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono font-bold">{value}</span>
        <button onClick={onDelete} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function TrendsView({ weightLogs, dietLogs, exerciseLogs }: any) {
  const weightData = useMemo(() => {
    return [...weightLogs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(l => ({ date: format(parseISO(l.date), 'MMM d'), weight: l.weight }));
  }, [weightLogs]);

  const calorieData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const label = format(d, 'MMM d');
      const caloriesIn = dietLogs.filter((l: any) => l.date === dateStr).reduce((acc: number, l: any) => acc + l.calories, 0);
      const caloriesOut = exerciseLogs.filter((l: any) => l.date === dateStr).reduce((acc: number, l: any) => acc + l.caloriesBurned, 0);
      return { date: label, in: caloriesIn, out: caloriesOut, net: caloriesIn - caloriesOut };
    }).reverse();
    return last7Days;
  }, [dietLogs, exerciseLogs]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
    >
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
        <h3 className="text-lg font-serif italic mb-6">Weight Trend</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weightData}>
              <defs>
                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A1A1A" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#1A1A1A" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} />
              <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="weight" stroke="#1A1A1A" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
        <h3 className="text-lg font-serif italic mb-6">Calorie Balance (Last 7 Days)</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={calorieData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" />
              <Bar dataKey="in" name="Calories In" fill="#FB923C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="out" name="Calories Out" fill="#60A5FA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileView({ profile, user }: any) {
  const [isEditing, setIsEditing] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        age: Number(data.age),
        height: Number(data.height),
        weight: Number(data.weight),
        gender: data.gender,
        activityLevel: data.activityLevel,
        goal: data.goal
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative">
          <img src={user.photoURL || `https://picsum.photos/seed/${user.uid}/200`} alt="Avatar" className="w-32 h-32 rounded-full border-4 border-white shadow-lg" referrerPolicy="no-referrer" />
          <div className="absolute bottom-0 right-0 p-2 bg-[#1A1A1A] text-white rounded-full border-4 border-white">
            <Settings size={16} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-serif italic">{profile?.displayName}</h2>
          <p className="text-gray-400 text-sm">{profile?.email}</p>
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-8 space-y-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold uppercase tracking-widest text-gray-400">Body Information</h3>
          <button onClick={() => setIsEditing(!isEditing)} className="text-sm font-bold text-[#1A1A1A] underline underline-offset-4">
            {isEditing ? 'Cancel' : 'Edit Info'}
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdateProfile} className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Age</label>
              <input name="age" type="number" defaultValue={profile?.age} className="w-full p-4 rounded-xl bg-gray-50 border-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Height (cm)</label>
              <input name="height" type="number" defaultValue={profile?.height} className="w-full p-4 rounded-xl bg-gray-50 border-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Weight (kg)</label>
              <input name="weight" type="number" step="0.1" defaultValue={profile?.weight} className="w-full p-4 rounded-xl bg-gray-50 border-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Gender</label>
              <select name="gender" defaultValue={profile?.gender} className="w-full p-4 rounded-xl bg-gray-50 border-none">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Activity Level</label>
              <select name="activityLevel" defaultValue={profile?.activityLevel} className="w-full p-4 rounded-xl bg-gray-50 border-none">
                <option value="sedentary">Sedentary</option>
                <option value="light">Lightly Active</option>
                <option value="moderate">Moderately Active</option>
                <option value="active">Very Active</option>
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Goal</label>
              <select name="goal" defaultValue={profile?.goal} className="w-full p-4 rounded-xl bg-gray-50 border-none">
                <option value="lose">Lose Weight</option>
                <option value="maintain">Maintain Weight</option>
                <option value="gain">Gain Weight</option>
              </select>
            </div>
            <button type="submit" className="col-span-2 py-4 bg-[#1A1A1A] text-white rounded-xl font-bold mt-4">Update Profile</button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            <InfoItem label="Age" value={profile?.age || '--'} unit="years" />
            <InfoItem label="Height" value={profile?.height || '--'} unit="cm" />
            <InfoItem label="Weight" value={profile?.weight || '--'} unit="kg" />
            <InfoItem label="Goal" value={profile?.goal || '--'} unit="" />
            <div className="col-span-2">
              <InfoItem label="Activity" value={profile?.activityLevel?.replace('_', ' ') || '--'} unit="" />
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={logOut}
        className="w-full py-4 bg-white text-red-500 rounded-[32px] font-bold border border-red-100 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
      >
        <LogOut size={20} /> Sign Out
      </button>
    </motion.div>
  );
}

function InfoItem({ label, value, unit }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-mono font-bold capitalize">{value}</span>
        <span className="text-[10px] text-gray-400 uppercase">{unit}</span>
      </div>
    </div>
  );
}
