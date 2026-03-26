'use client';

import React, { useState } from 'react';
import { Lock, Hotel as HotelIcon, ChevronRight, UserCircle, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { useAuth, UserProfile } from '@/providers/AuthProvider';

export default function LoginPage() {
    const [department, setDepartment] = useState<string>('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const router = useRouter();
    const { login } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // DB'den staff_users tablosunu sorguluyoruz.
            // Sadece seçili departmandakileri de getirebiliriz, şimdilik username e göre getiriyoruz.
            const { data: users, error: supabaseError } = await supabase
                .from('staff_users')
                .select('*')
                .eq('username', username)
                .limit(1);

            if (supabaseError) {
                console.error("Supabase Login Error:", supabaseError.message);
                throw new Error("Veritabanı bağlantı hatası!");
            }

            const user = users?.[0];

            if (user && user.password_hash === password) {
                // Yeni bir oturum token'ı oluştur (Eski açık oturumları geçersiz kılacak)
                const newSessionToken = Date.now().toString() + Math.random().toString();
                
                // Veritabanını yeni token ile güncelle
                await supabase.from('staff_users')
                    .update({ session_token: newSessionToken })
                    .eq('id', user.id);

                const userProfile: UserProfile = {
                    id: user.id,
                    username: user.username,
                    department: user.department,
                    session_token: newSessionToken
                };
                
                await login(userProfile);
                
                // Kullanıcının departmanına göre yönlendir
                if (user.department === 'reception') router.push('/reception');
                else if (user.department === 'guest-relation') router.push('/guest-relation');
                else if (user.department === 'technical-service') router.push('/technical-service');
                else router.push('/dashboard'); // Başka bir departman ise
            } else {
                setError('Geçersiz kullanıcı adı veya şifre!');
            }
        } catch (err: any) {
            setError(err.message || 'Giriş sırasında bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/20 to-transparent pointer-events-none"></div>
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-600/10 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex bg-blue-600 p-4 rounded-3xl shadow-2xl shadow-blue-500/30 mb-6 border border-blue-400">
                        <HotelIcon className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-2">GUESTFLOW <span className="text-blue-500">AI</span></h1>
                    <p className="text-blue-300 font-medium">Lütfen Departman Seçin ve Giriş Yapın</p>
                </div>

                <div className="glass-card p-10 bg-slate-900/80 border border-blue-900/50 backdrop-blur-xl">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-xs font-black text-blue-400 uppercase tracking-widest mb-3">Departman Seç</label>
                            <div className="relative group mb-4">
                                <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                                <select
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    className="w-full bg-slate-800 border-2 border-slate-700 text-white rounded-2xl pl-12 pr-10 py-4 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="" disabled>Lütfen Departman Seçin</option>
                                    <option value="reception">Resepsiyon (F/O)</option>
                                    <option value="guest-relation">Misafir İlişkileri (G/R)</option>
                                    <option value="housekeeping">Housekeeping (H/K)</option>
                                    <option value="technical-service">Teknik Servis (T/S)</option>
                                </select>
                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                    <svg className="w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-blue-400 uppercase tracking-widest mb-3">Kullanıcı Adı</label>
                            <div className="relative group mb-4">
                                <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Kullanıcı adı (admin)"
                                    className="w-full bg-slate-800 border-2 border-slate-700 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                />
                            </div>

                            <label className="block text-xs font-black text-blue-400 uppercase tracking-widest mb-3">Giriş Şifresi</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••"
                                    className="w-full bg-slate-800 border-2 border-slate-700 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono tracking-widest"
                                />
                            </div>
                            {error && <p className="text-red-400 text-xs font-bold mt-2 animate-bounce">{error}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-5 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-black text-lg rounded-2xl shadow-2xl shadow-blue-600/30 transition-all flex items-center justify-center group ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? 'GİRİŞ YAPILIYOR...' : 'PANELİ AÇ'}
                            {!isLoading && <ChevronRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />}
                        </button>
                    </form>
                </div>

                <p className="text-center text-slate-500 text-xs mt-8">
                    &copy; 2026 GuestFlow AI Otomasyon Sistemleri. Tüm hakları saklıdır.
                </p>
            </div>
        </div>
    );
}
