'use client';

import React, { useState, useEffect, Suspense } from 'react';
import {
    Settings, Shield, Key, Save, UserCheck,
    LayoutDashboard, MessageSquare, Activity,
    Terminal, Bell, Search, Trash2, Clock, Globe
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

type TabType = 'access' | 'api' | 'users' | 'channels' | 'logs' | 'location';

function SettingsContent() {
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get('tab') as TabType) || 'access';

    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const [receptionPassword, setReceptionPassword] = useState('1234');
    const [guestRelationPassword, setGuestRelationPassword] = useState('1234');
    const [openaiKey, setOpenaiKey] = useState('sk-proj-••••••••••••••••');
    const [timezone, setTimezone] = useState('Europe/Istanbul');
    const [saved, setSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Location Settings
    const [hotelLocationUrl, setHotelLocationUrl] = useState('');
    const [hotelLocationDesc, setHotelLocationDesc] = useState('');
    const [isLocationLoaded, setIsLocationLoaded] = useState(false);

    // Departman bazlı kanal ayarları state'i
    const [deptConfigs, setDeptConfigs] = useState([
        { name: 'Resepsiyon', icon: '🛎️', telegramIds: '', whatsappIds: '', is24Hours: true, startTime: '00:00', endTime: '23:59', isCentral: true },
        { name: 'Housekeeping', icon: '🧹', telegramIds: '', whatsappIds: '', is24Hours: true, startTime: '08:00', endTime: '23:59' },
        { name: 'Teknik Servis', icon: '🔧', telegramIds: '', whatsappIds: '', is24Hours: true, startTime: '08:00', endTime: '18:00' },
        { name: 'F&B (Gastro)', icon: '🍽️', telegramIds: '', whatsappIds: '', is24Hours: true, startTime: '08:00', endTime: '00:00' },
        { name: 'Guest Relation', icon: '🤝', telegramIds: '', whatsappIds: '', is24Hours: true, startTime: '08:00', endTime: '00:00' }
    ]);

    const handleDeptConfigChange = (deptName: string, field: string, value: string | boolean) => {
        setDeptConfigs(prev => prev.map(dept =>
            dept.name === deptName ? { ...dept, [field]: value } : dept
        ));
    };

    // URL'den tab değişirse state'i güncelle
    useEffect(() => {
        const tab = searchParams.get('tab') as TabType;
        if (tab && ['access', 'api', 'users', 'channels', 'logs', 'location'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Konum verisini veritabanından çek
    useEffect(() => {
        if (activeTab === 'location' && !isLocationLoaded) {
            const fetchLocation = async () => {
                try {
                    const { data, error } = await supabase
                        .from('hotel_settings')
                        .select('value')
                        .eq('key', 'hotel_location')
                        .single();
                    if (!error && data && data.value) {
                        setHotelLocationUrl(data.value.url || '');
                        setHotelLocationDesc(data.value.description || '');
                    }
                    setIsLocationLoaded(true);
                } catch (e) {
                    console.error("Location fetch hatası", e);
                }
            };
            fetchLocation();
        }
    }, [activeTab, isLocationLoaded]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (activeTab === 'location') {
                const newValue = { url: hotelLocationUrl, description: hotelLocationDesc };
                await supabase.from('hotel_settings').upsert({
                    key: 'hotel_location',
                    value: newValue,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error("Kaydetme hatası:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Sahte Log Verileri
    const mockLogs = [
        { id: 1, event: "Sistem Girişi", user: "Admin (Özgür)", status: "SUCCESS", time: "10:15:22", desc: "Kontrol paneline başarılı giriş yapıldı." },
        { id: 2, event: "API Çağrısı", user: "AI Engine", status: "SUCCESS", time: "10:14:05", desc: "OpenAI gpt-4o modeli ile diyalog kuruldu." },
        { id: 3, event: "Webhook Hatası", user: "ManyChat", status: "ERROR", time: "09:55:10", desc: "Gelen istek imzası doğrulanamadı (HMAC Error)." },
        { id: 4, event: "Şifre Değişimi", user: "System", status: "INFO", time: "08:30:00", desc: "Resepsiyon giriş şifresi güncellendi." },
        { id: 5, event: "Talep Ataması", user: "AI Manager", status: "SUCCESS", time: "Yarım saat önce", desc: "HTL-2831 nolu talep Housekeeping'e atandı." }
    ];

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-5">
                        <div className="bg-gradient-to-br from-blue-600 to-sky-600 p-4 rounded-3xl shadow-xl shadow-blue-500/20">
                            <Settings className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tighter uppercase italic">Sistem <span className="text-blue-500">Panel Ayarları</span></h1>
                            <p className="text-slate-400 font-medium mt-1">GuestFlow AI Platform Gelişmiş Yapılandırma</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <Link
                            href="/settings"
                            className="inline-flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50 px-6 py-4 rounded-2xl transition-all border border-slate-700 backdrop-blur-sm font-bold text-sm group"
                        >
                            <Trash2 className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
                            Geri Dön
                        </Link>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl transition-all border border-blue-400 shadow-lg shadow-blue-600/20 font-bold text-sm group"
                        >
                            <LayoutDashboard className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                            Dashboard
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left Sidebar - Navigation */}
                    <div className="lg:col-span-3 space-y-3">
                        <NavButton
                            id="access"
                            label="Erişim Yetkileri"
                            icon={<Shield className="w-5 h-5" />}
                            active={activeTab === 'access'}
                            onClick={() => setActiveTab('access')}
                        />
                        <NavButton
                            id="api"
                            label="API Anahtarları"
                            icon={<Key className="w-5 h-5" />}
                            active={activeTab === 'api'}
                            onClick={() => setActiveTab('api')}
                        />
                        <NavButton
                            id="users"
                            label="Kullanıcı Yönetimi"
                            icon={<UserCheck className="w-5 h-5" />}
                            active={activeTab === 'users'}
                            onClick={() => setActiveTab('users')}
                        />
                        <NavButton
                            id="channels"
                            label="Kanal Ayarları"
                            icon={<MessageSquare className="w-5 h-5" />}
                            active={activeTab === 'channels'}
                            onClick={() => setActiveTab('channels')}
                        />
                        <NavButton
                            id="location"
                            label="Konum ve Harita"
                            icon={<Settings className="w-5 h-5 text-green-400" />}
                            active={activeTab === 'location'}
                            onClick={() => setActiveTab('location')}
                        />
                        <NavButton
                            id="logs"
                            label="Sistem Logları"
                            icon={<Activity className="w-5 h-5" />}
                            active={activeTab === 'logs'}
                            onClick={() => setActiveTab('logs')}
                        />
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-9">
                        <div className="bg-slate-900/40 border border-slate-800/60 rounded-[32px] p-10 backdrop-blur-2xl shadow-2xl relative overflow-hidden group min-h-[600px] flex flex-col">

                            <div className="flex-1">
                                {/* TAB: ACCESS */}
                                {activeTab === 'access' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <TabHeader title="DEPARTMAN YETKİLERİ" desc="Panellere giriş şifrelerini buradan yönetin." icon={<Shield className="w-6 h-6 text-blue-500" />} />
                                        <div className="grid md:grid-cols-2 gap-8">
                                            <InputField label="Resepsiyon Şifresi" type="password" value={receptionPassword} onChange={setReceptionPassword} />
                                            <InputField label="Guest Relation Şifresi" type="password" value={guestRelationPassword} onChange={setGuestRelationPassword} />
                                        </div>
                                    </div>
                                )}

                                {/* TAB: API KEYS */}
                                {activeTab === 'api' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <TabHeader title="API YAPILANDIRMASI" desc="Yapay zeka ve servis anahtarları." icon={<Key className="w-6 h-6 text-blue-500" />} />
                                        <div className="space-y-6">
                                            <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-3xl">
                                                <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                                    OpenAI Ayarları
                                                </h3>
                                                <InputField label="OpenAI API Key" type="password" value={openaiKey} onChange={setOpenaiKey} placeholder="sk-••••" />
                                            </div>
                                            <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-3xl">
                                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">Perplexity API</h3>
                                                <InputField label="Perplexity API Key" type="password" value="••••••••" onChange={() => { }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB: CHANNELS */}
                                {activeTab === 'channels' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <TabHeader title="MESAJLAŞMA KANALLARI" desc="Departman sorumlularını ve vardiya bazlı yönlendirmeyi yönetin." icon={<MessageSquare className="w-6 h-6 text-blue-500" />} />

                                        {/* Global Timezone Setting */}
                                        <div className="mb-10 p-6 bg-slate-950/20 border border-slate-800 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-blue-600/10 rounded-2xl">
                                                    <Globe className="w-6 h-6 text-blue-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Sistem Zaman Dilimi</h4>
                                                    <p className="text-xs text-slate-500">Vardiya saatleri bu bölgeye göre hesaplanır.</p>
                                                </div>
                                            </div>
                                            <select
                                                value={timezone}
                                                onChange={(e) => setTimezone(e.target.value)}
                                                className="bg-slate-900 border border-slate-700 text-white px-5 py-3 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-sm"
                                            >
                                                <option value="Europe/Istanbul">İstanbul (GMT+3)</option>
                                                <option value="Europe/London">Londra (GMT+0)</option>
                                                <option value="Europe/Berlin">Berlin (GMT+1)</option>
                                                <option value="America/New_York">New York (GMT-5)</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-1 gap-8 mb-12">
                                            <p className="text-amber-400 bg-amber-400/10 border border-amber-500/20 p-5 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-4 italic">
                                                <Bell className="w-6 h-6 shrink-0 mt-0.5" />
                                                KURAL: Eğer bir departman mesai saatleri dışındaysa, gelen tüm misafir talepleri yapay zeka tarafından otomatik olarak RESEPSİYON (Vardiya Sorumlusu) kanalına iletilir.
                                            </p>

                                            {deptConfigs.map((dept) => (
                                                <div key={dept.name} className={`p-8 bg-slate-950/40 border-2 rounded-[40px] transition-all group shadow-xl ${dept.isCentral ? 'border-blue-500/50' : 'border-slate-800 hover:border-blue-500/40'}`}>
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-800/50 pb-6">
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-3xl bg-slate-800 w-14 h-14 flex items-center justify-center rounded-2xl shadow-inner">{dept.icon}</span>
                                                            <div>
                                                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">{dept.name} {dept.isCentral && <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded ml-2">ANA MERKEZ</span>}</h3>
                                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Konfigürasyon Ve Bildirimler</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-2xl border border-slate-800">
                                                            <input
                                                                type="checkbox"
                                                                checked={dept.is24Hours}
                                                                onChange={(e) => handleDeptConfigChange(dept.name, 'is24Hours', e.target.checked)}
                                                                className="w-5 h-5 rounded-lg accent-blue-500 cursor-pointer"
                                                            />
                                                            <label className="text-xs font-black text-slate-300 uppercase tracking-widest cursor-pointer">24 SAAT AKTİF</label>
                                                        </div>
                                                    </div>

                                                    <div className="grid lg:grid-cols-2 gap-10">
                                                        {/* ID Ayarları */}
                                                        <div className="space-y-6">
                                                            <h4 className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest px-1">
                                                                <MessageSquare className="w-4 h-4" /> BİLDİRİM KANALLARI (ID LİSTESİ)
                                                            </h4>
                                                            <InputField
                                                                label="Telegram ID(leri)"
                                                                type="text"
                                                                value={dept.telegramIds}
                                                                onChange={(v) => handleDeptConfigChange(dept.name, 'telegramIds', v)}
                                                                placeholder="123456, 789012"
                                                            />
                                                            <InputField
                                                                label="WhatsApp ID(leri)"
                                                                type="text"
                                                                value={dept.whatsappIds}
                                                                onChange={(v) => handleDeptConfigChange(dept.name, 'whatsappIds', v)}
                                                                placeholder="90555..."
                                                            />
                                                        </div>

                                                        {/* Vardiya Ayarları */}
                                                        <div className={`space-y-6 transition-all duration-500 ${dept.is24Hours ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                                            <h4 className="flex items-center gap-2 text-[10px] font-black text-orange-400 uppercase tracking-widest px-1">
                                                                <Clock className="w-4 h-4" /> VARDİYA / MESAİ SAATLERİ
                                                            </h4>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <InputField
                                                                    label="BAŞLANGIÇ"
                                                                    type="time"
                                                                    value={dept.startTime}
                                                                    onChange={(v) => handleDeptConfigChange(dept.name, 'startTime', v)}
                                                                    disabled={dept.is24Hours}
                                                                />
                                                                <InputField
                                                                    label="BİTİŞ"
                                                                    type="time"
                                                                    value={dept.endTime}
                                                                    onChange={(v) => handleDeptConfigChange(dept.name, 'endTime', v)}
                                                                    disabled={dept.is24Hours}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 font-bold px-1 italic">
                                                                * Bu saatler dışındaki tüm talepler yapay zeka tarafından <strong>Resepsiyon</strong> servisine yönlendirilir.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Genel Ayarlar */}
                                        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-[40px] p-10">
                                            <TabHeader title="GENEL KANAL AYARLARI" desc="Sistemin mesaj göndermek için kullandığı ana servis bağlantıları." icon={<Settings className="w-6 h-6 text-blue-500" />} />
                                            <div className="grid md:grid-cols-2 gap-8">
                                                <InputField label="Bot API Token (Telegram)" type="password" value="123456:ABC..." onChange={() => { }} />
                                                <InputField label="ManyChat API Key (WhatsApp)" type="password" value="••••••••" onChange={() => { }} />
                                                <div className="md:col-span-2">
                                                    <InputField label="Webhook URL (Merkezi)" type="text" value="https://h1i732o9.rcsrv.net/webhook/hotel-otomasyon" onChange={() => { }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB: USERS */}
                                {activeTab === 'users' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <TabHeader title="KULLANICI YÖNETİMİ" desc="Sistem operatörleri ve erişim rolleri." icon={<UserCheck className="w-6 h-6 text-blue-500" />} />
                                        <div className="space-y-4">
                                            {['Admin (Özgür)', 'Resepsiyon Ekibi', 'Misafir İlişkileri (GA)'].map((name, i) => (
                                                <div key={i} className="flex items-center justify-between p-5 bg-slate-950/30 border border-slate-800 rounded-2xl group hover:border-blue-500/30 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-blue-400">{name[0]}</div>
                                                        <div className="font-bold text-slate-200">{name}</div>
                                                    </div>
                                                    <div className="px-3 py-1 bg-blue-600/10 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-500/20">AKTİF YETKİLİ</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* TAB: LOGS */}
                                {activeTab === 'logs' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <TabHeader title="SİSTEM HAREKET LOGLARI" desc="Anlık sistem olayları ve API trafiği." icon={<Terminal className="w-6 h-6 text-blue-500" />} />
                                        <div className="bg-slate-950/50 border border-slate-800 rounded-3xl overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-900/80 border-b border-slate-800">
                                                    <tr>
                                                        <th className="px-6 py-4 font-black uppercase tracking-tighter text-slate-500">Olay / Kullanıcı</th>
                                                        <th className="px-6 py-4 font-black uppercase tracking-tighter text-slate-500">Durum</th>
                                                        <th className="px-6 py-4 font-black uppercase tracking-tighter text-slate-500">Zaman</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/50">
                                                    {mockLogs.map(log => (
                                                        <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="font-bold text-slate-200">{log.event}</div>
                                                                <div className="text-xs text-slate-500">{log.user} - {log.desc}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${log.status === 'SUCCESS' ? 'bg-green-500/10 text-green-400' :
                                                                    log.status === 'ERROR' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                                                                    }`}>
                                                                    {log.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs text-slate-500 font-mono">{log.time}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* TAB: LOCATION */}
                                {activeTab === 'location' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <TabHeader title="OTEL KONUM VE YOL TARİFİ" desc="Ön Büro ve Genel bilgi için misafirlere otomatik gönderilecek konum bilgileri." icon={<Settings className="w-6 h-6 text-green-500" />} />
                                        <div className="space-y-6">
                                            <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-3xl">
                                                <div className="mb-4 text-green-400 font-bold bg-green-500/10 p-4 rounded-xl text-sm border border-green-500/20">
                                                    Bu ayarlar, misafir Telegram/WhatsApp üzerinden "Konum nerede?", "Nasıl gelirim?" gibi sorular sorduğunda yapay zeka tarafından doğrudan gönderilecektir.
                                                </div>
                                                <div className="space-y-6">
                                                    <InputField 
                                                        label="Google Maps Veya Harita Linki" 
                                                        type="text" 
                                                        value={hotelLocationUrl} 
                                                        onChange={setHotelLocationUrl} 
                                                        placeholder="https://maps.app.goo.gl/..." 
                                                    />
                                                    <div className="space-y-2">
                                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest px-1">Rota ve Rehberlik Açıklaması</label>
                                                        <textarea
                                                            value={hotelLocationDesc}
                                                            onChange={(e) => setHotelLocationDesc(e.target.value)}
                                                            placeholder="Lütfen sahil yolunu kullanmayınız, arka sokaktaki ana girişten daha kolay ulaşabilirsiniz."
                                                            className="w-full bg-slate-950/50 border-2 border-slate-800 text-white rounded-2xl px-5 py-4 focus:outline-none focus:border-green-500 transition-all font-mono placeholder-slate-700 h-32 resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Save Button */}
                            {activeTab !== 'logs' && (
                                <div className="mt-12 flex items-center justify-end">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className={`flex items-center gap-3 px-10 py-5 rounded-[22px] font-black transition-all ${saved
                                            ? 'bg-green-600 text-white shadow-lg shadow-green-500/20'
                                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-2xl shadow-blue-600/30'
                                            } ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {saved ? 'GÜNCELLENDİ!' : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                {isSaving ? 'KAYDEDİLİYOR...' : 'AYARLARI KAYDET'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Status bar */}
                        <div className="mt-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-4 items-start text-sm">
                            <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-slate-400">
                                <strong className="text-blue-500">Sistem Bilgisi:</strong> Değişiklikler tüm terminallerde anında aktif olur. Loglar sadece son 24 saati gösterir.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function NavButton({ id, label, icon, active, onClick }: { id: TabType; label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between group p-5 rounded-2xl font-black text-sm transition-all border-2 ${active
                ? 'bg-blue-600/10 border-blue-500/50 text-blue-400 shadow-lg shadow-blue-500/5'
                : 'bg-slate-900/30 border-transparent text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
        >
            <div className="flex items-center gap-3">
                {icon}
                {label}
            </div>
            {active && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>}
        </button>
    );
}

function TabHeader({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-800">
            <div className="p-3 bg-blue-600/10 rounded-2xl">{icon}</div>
            <div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">{title}</h2>
                <p className="text-slate-500 text-sm font-medium">{desc}</p>
            </div>
        </div>
    );
}

function InputField({ label, type, value, onChange, placeholder, disabled = false }: { label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
    return (
        <div className="space-y-2">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest px-1">{label}</label>
            <div className="relative group">
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full bg-slate-950/50 border-2 border-slate-800 text-white rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-all font-mono placeholder-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
                />
            </div>
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Yükleniyor...</div>}>
            <SettingsContent />
        </Suspense>
    );
}
