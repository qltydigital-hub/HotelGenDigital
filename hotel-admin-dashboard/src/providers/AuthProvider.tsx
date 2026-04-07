'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, writeLog } from '@/lib/supabase-client';

export type UserProfile = {
    id: string; // id is UUID in DB, so string is safer actually, but keeping it whatever it was. Wait, let me check the existing id type: it was number? Actually supabase id in staff_users is UUID. I will change id to string.
    username: string;
    department: string;
    session_token?: string | null;
    tenant_id?: string; // SaaS için hangi otele ait olduğu
};

interface AuthContextType {
    user: UserProfile | null;
    login: (user: UserProfile) => void;
    logout: (reason?: string, clearGlobalSession?: boolean) => void;
    forceLogoutFromEverywhere: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    login: () => {},
    logout: () => {},
    forceLogoutFromEverywhere: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    // Inactivity timeout (5 minutes = 300,000ms)
    const INACTIVITY_LIMIT = 5 * 60 * 1000;
    const [lastActivity, setLastActivity] = useState<number>(Date.now());

    // Oturum kontrolü
    useEffect(() => {
        const storedUser = localStorage.getItem('guestflow_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
            setLastActivity(Date.now());
        } else if (pathname !== '/login' && pathname !== '/') {
            // Login ve Landing page dışında giriş yapılmamışsa logine at
            router.push('/login');
        }
    }, [pathname, router]);

    const login = useCallback(async (newUser: UserProfile) => {
        setUser(newUser);
        localStorage.setItem('guestflow_user', JSON.stringify(newUser));
        
        // Loglama
        try {
            await writeLog('SUCCESS', 'AUTH', `${newUser.username} sisteme giriş yaptı.`);
        } catch (e) {
            console.error('Log error', e);
        }
    }, []);

    const logout = useCallback(async (reason: string = 'Kullanıcı çıkış yaptı', clearGlobalSession: boolean = true) => {
        if (user) {
            try {
                // Eğer kullanıcı KENDİSİ çıkış yapıyorsa (sistem atmıyorsa), DB'deki tokeni iptal et ki her yerde kapansın!
                if (clearGlobalSession && user.department !== 'settings' && user.department !== 'admin') {
                    await supabase.from('staff_users')
                        .update({ session_token: null })
                        .eq('id', user.id);
                }
                await writeLog('INFO', 'AUTH', `${user.username} sistemden ayrıldı: ${reason}`);
            } catch (e) {
                console.error('Log error', e);
            }
        }
        setUser(null);
        localStorage.removeItem('guestflow_user');
        router.push('/login');
    }, [user, router]);

    const forceLogoutFromEverywhere = useCallback(async () => {
        if (!user) return;
        try {
            if (user.department !== 'settings' && user.department !== 'admin') {
                // DB deki tokeni degistiriyoruz ki kontrol eden her cihaz (kendi dahil) atilsin
                const newToken = Date.now().toString() + Math.random().toString();
                await supabase.from('staff_users')
                    .update({ session_token: newToken })
                    .eq('id', user.id);
            }
            await writeLog('INFO', 'AUTH', `${user.username} tüm oturumları sistemden kapattı.`);
        } catch (e) {
            console.error('Force logout error:', e);
        }
        logout('Tüm cihazlardan çıkış yapıldı.');
    }, [user, logout]);

    // Inactivity Tracking
    useEffect(() => {
        if (!user || pathname === '/login') return;

        const updateActivity = () => {
            setLastActivity(Date.now());
        };

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(event => window.addEventListener(event, updateActivity));

        const checkInactivity = setInterval(() => {
            const now = Date.now();
            if (now - lastActivity > INACTIVITY_LIMIT) {
                logout('5 dakikalık hareketsizlik nedeniyle oturumunuz otomatik olarak sonlandırıldı.', true);
            }
        }, 10000); // Check every 10 seconds

        return () => {
            events.forEach(event => window.removeEventListener(event, updateActivity));
            clearInterval(checkInactivity);
        };
    }, [user, pathname, lastActivity, logout, INACTIVITY_LIMIT]);


    // Timer bazlı otomatik DB token kontrolü
    useEffect(() => {
        if (!user || pathname === '/login') return;
        if (user.department === 'settings' || user.department === 'admin') return; // Skip DB token checks for static admin setups

        const checkSession = async () => {
            try {
                const { data, error } = await supabase
                    .from('staff_users')
                    .select('session_token')
                    .eq('id', user.id)
                    .single();

                if (!error && data) {
                    if (data.session_token && data.session_token !== user.session_token) {
                        // Sistem atıyorsa DB'yi temizleme! (Çünkü yeni cihazın tokenini siler)
                        logout('Oturumunuz başka bir cihazdan "Tüm Açık Oturumlar Kapatıldı" komutu ile sonlandırıldı.', false);
                    } else if (data.session_token === null) {
                        // Başka bir cihazdan normal Çıkış basılarak token silindiyse
                        logout('Hesabınız güvenli şekilde kapatıldığı için bu cihazdaki oturum da sonlandırıldı.', false);
                    }
                }
            } catch (e) {
                console.error("Session check error", e);
            }
        };

        const interval = setInterval(checkSession, 15000); // 15 saniyede bir kontrol eder
        return () => clearInterval(interval);
    }, [user, pathname, logout]);

    return (
        <AuthContext.Provider value={{ user, login, logout, forceLogoutFromEverywhere }}>
            {children}
        </AuthContext.Provider>
    );
}
