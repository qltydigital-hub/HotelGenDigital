'use client';
import React from 'react';
import { Settings, UserCircle, Key, Shield, MessageSquare, Ticket, Users, BarChart } from 'lucide-react';
import Link from 'next/link';

export default function OldSettingsPage() {
    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-4 rounded-2xl shadow-xl shadow-blue-500/20">
                            <Settings className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tight">HOTEL & <span className="text-blue-500">ADMIN AYARLARI</span></h1>
                            <p className="text-slate-400 font-medium">Sistem konfigürasyonu ve yönetim paneli</p>
                        </div>
                    </div>
                    <Link href="/" className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-700 text-sm">
                        Dashboard'a Dön
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* DEPARTMAN YETKİLERİ */}
                    <Link href="/settings-panel?tab=access" className="group">
                        <div className="h-full bg-slate-900 border border-blue-500/30 hover:border-blue-500 rounded-[32px] p-8 transition-all hover:bg-blue-500/5 shadow-lg hover:shadow-blue-500/10 relative overflow-hidden">
                            <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/50">
                                <Shield className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-black mb-3">DEPARTMAN YETKİLERİ</h2>
                            <p className="text-slate-400 font-medium text-sm leading-relaxed mb-6">Resepsiyon, Guest Relation ve Admin şifrelerini, panellere olan erişim yetkilerini buradan tanımlayın.</p>
                            <div className="flex items-center text-blue-400 font-black text-xs tracking-widest gap-2 uppercase">
                                Kontrol Et →
                            </div>
                        </div>
                    </Link>

                    {/* API ANAHTARLARI */}
                    <Link href="/settings-panel?tab=api" className="group">
                        <div className="h-full bg-slate-900 border border-slate-800 hover:border-blue-500/30 rounded-[32px] p-8 transition-all hover:bg-slate-800/50 shadow-lg relative overflow-hidden">
                            <div className="bg-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-slate-700">
                                <Key className="w-8 h-8 text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-black mb-3">API ANAHTARLARI</h2>
                            <p className="text-slate-400 font-medium text-sm leading-relaxed mb-6">OpenAI, Perplexity ve ManyChat API entegrasyonlarını, token yapılandırmasını yönetin.</p>
                            <div className="flex items-center text-slate-500 font-black text-xs tracking-widest gap-2 uppercase group-hover:text-blue-400 transition-colors">
                                Yapılandır →
                            </div>
                        </div>
                    </Link>

                    {/* KULLANICI YÖNETİMİ */}
                    <Link href="/settings-panel?tab=users" className="group">
                        <div className="h-full bg-slate-900 border border-slate-800 hover:border-blue-500/30 rounded-[32px] p-8 transition-all hover:bg-slate-800/50 shadow-lg relative overflow-hidden">
                            <div className="bg-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-slate-700">
                                <UserCircle className="w-8 h-8 text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-black mb-3">KULLANICI YÖNETİMİ</h2>
                            <p className="text-slate-400 font-medium text-sm leading-relaxed mb-6">Sistem kullanıcılarını, rollerini ve erişim seviyelerini yetkilendirme tablosundan düzenleyin.</p>
                            <div className="flex items-center text-slate-500 font-black text-xs tracking-widest gap-2 uppercase group-hover:text-blue-400 transition-colors">
                                Yönet →
                            </div>
                        </div>
                    </Link>

                    {/* TELEGRAM & WHATSAPP AYARLARI */}
                    <Link href="/settings-panel?tab=channels" className="group">
                        <div className="h-full bg-slate-900 border border-slate-800 hover:border-blue-500/30 rounded-[32px] p-8 transition-all hover:bg-slate-800/50 shadow-lg relative overflow-hidden">
                            <div className="bg-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-slate-700">
                                <MessageSquare className="w-8 h-8 text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-black mb-3">TELEGRAM - WHATSAPP</h2>
                            <p className="text-slate-400 font-medium text-sm leading-relaxed mb-6">Mesajlaşma kanallarının Chat ID, Bot ID ve Webhook bağlantılarını dinamik olarak kurun.</p>
                            <div className="flex items-center text-slate-500 font-black text-xs tracking-widest gap-2 uppercase group-hover:text-blue-400 transition-colors">
                                Kanal Ayarları →
                            </div>
                        </div>
                    </Link>

                    {/* DİĞER MODÜLLER - LOGLAR */}
                    <Link href="/settings-panel?tab=logs" className="group">
                        <div className="h-full bg-slate-900 border border-slate-800 hover:border-blue-500/30 rounded-[32px] p-8 transition-all hover:bg-slate-800/50 shadow-lg relative overflow-hidden">
                            <div className="bg-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-slate-700">
                                <BarChart className="w-8 h-8 text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-black mb-3">SİSTEM LOGLARI</h2>
                            <p className="text-slate-400 font-medium text-sm leading-relaxed mb-6">Sistem çalışma hatalarını, API çağrılarını ve veritabanı işlemlerini anlık takip edin.</p>
                            <div className="flex items-center text-slate-500 font-black text-xs tracking-widest gap-2 uppercase group-hover:text-blue-400 transition-colors">
                                İzle →
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Info Box */}
                <div className="mt-12 p-8 bg-blue-600/5 border border-blue-500/20 rounded-[32px] flex items-start gap-6">
                    <div className="p-3 bg-blue-600/10 rounded-xl">
                        <Shield className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-blue-400 uppercase tracking-widest mb-1">BİLGİ BANKASI VE GÜVENLİK</h4>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">
                            Buradaki ayarlar sistemin kalbini oluşturur. API anahtarlarının ve kullanıcı yetkilerinin değiştirilmesi tüm otel otomasyonunu etkiler.
                            Şifre değişikliklerinden sonra tüm aktif oturumların sonlandırılacağını unutmayın.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
