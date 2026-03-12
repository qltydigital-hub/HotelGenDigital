"use client";
import React, { useState } from 'react';
import { ShieldCheck, MessageCircle, Send, Plus, Trash2, Users, Save, CheckCircle2, Settings, Clock } from 'lucide-react';
import Link from 'next/link';

export const ALL_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'];
export const SHIFTS = ['08:00 - 16:00', '16:00 - 00:00', '00:00 - 08:00', '08:00 - 18:00', '09:00 - 17:00', '7/24'];

type Department = {
  id: number;
  name: string;
  telegramId: string;
  whatsappId: string;
  shift: string;
  workingDays: string[];
};

export default function AdminPanel() {
  const [saved, setSaved] = useState(false);
  const [newDept, setNewDept] = useState('');
  
  const [departments, setDepartments] = useState<Department[]>([
    { id: 1, name: 'Resepsiyon (Ön Büro)', telegramId: '-419082348', whatsappId: '+905551234567', shift: '7/24', workingDays: [...ALL_DAYS] },
    { id: 2, name: 'Misafir İlişkileri (Guest Relation)', telegramId: '-412345678', whatsappId: '+905559876543', shift: '08:00 - 16:00', workingDays: [...ALL_DAYS] },
    { id: 3, name: 'Kat Hizmetleri (Housekeeping)', telegramId: '', whatsappId: '', shift: '08:00 - 16:00', workingDays: [...ALL_DAYS] },
    { id: 4, name: 'Yiyecek & İçecek (F&B)', telegramId: '', whatsappId: '', shift: '16:00 - 00:00', workingDays: [...ALL_DAYS] },
    { id: 5, name: 'Teknik Servis', telegramId: '', whatsappId: '', shift: '08:00 - 18:00', workingDays: [...ALL_DAYS] },
  ]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateDept = (id: number, field: keyof Department, value: any) => {
    setDepartments(departments.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const toggleDay = (deptId: number, day: string) => {
    setDepartments(departments.map(d => {
      if (d.id === deptId) {
        const days = d.workingDays.includes(day) 
          ? d.workingDays.filter(dayName => dayName !== day)
          : [...d.workingDays, day];
        return { ...d, workingDays: days };
      }
      return d;
    }));
  };

  const addDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    setDepartments([...departments, {
      id: Date.now(),
      name: newDept,
      telegramId: '',
      whatsappId: '',
      shift: '08:00 - 16:00',
      workingDays: [...ALL_DAYS]
    }]);
    setNewDept('');
  };

  const removeDept = (id: number) => {
    setDepartments(departments.filter(d => d.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-5">
            <div className="bg-purple-600/20 p-4 rounded-2xl border border-purple-500/30">
              <ShieldCheck className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">VIP Yönetici Paneli</h1>
              <p className="text-slate-400 font-medium mt-1">Özgür ÖZEN & Kemal KUYUCU Özel Erişim Paneli</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link href="/settings" className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 text-sm">
              <Settings className="w-4 h-4" /> Hotel Sistem Ayarları
            </Link>
            <Link href="/" className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-700 text-sm flex items-center justify-center gap-2">
              ← Sunum Ekranına Dön
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
                <Users className="w-6 h-6 text-purple-500" /> Departman Yönlendirme ID'leri
              </h2>
              <p className="text-slate-400 text-sm max-w-2xl">
                Misafirlerden gelen standart dışı özel isteklerin ve bildirimlerin doğrudan düşeceği Telegram Grup ID'lerini veya WhatsApp Numara/Grup ID'lerini buradan yönetin.
              </p>
            </div>
            {saved && (
              <span className="hidden md:flex items-center gap-2 text-sm font-bold text-green-400 bg-green-900/20 px-4 py-2 rounded-xl border border-green-500/30 animate-pulse">
                <CheckCircle2 className="w-4 h-4" />
                Başarıyla Kaydedildi
              </span>
            )}
          </div>

          <div className="space-y-4 mb-8">
            {departments.map((dept) => (
              <div key={dept.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-950/50 p-4 rounded-2xl border border-slate-800 hover:border-purple-500/30 transition-colors">
                
                {/* Departman Adı */}
                <div className="md:col-span-3 font-bold text-lg text-blue-100 flex items-center justify-between">
                  {dept.name}
                  {dept.id > 5 && (
                    <button onClick={() => removeDept(dept.id)} className="text-red-400 hover:text-red-300 p-1 md:hidden">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Telegram ID */}
                <div className="md:col-span-4 relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-blue-500/20 p-1.5 rounded-lg group-hover:bg-blue-500/40 transition-colors">
                    <Send className="w-4 h-4 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    value={dept.telegramId}
                    onChange={(e) => updateDept(dept.id, 'telegramId', e.target.value)}
                    placeholder="Telegram Grup ID (-100...)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                {/* WhatsApp ID */}
                <div className="md:col-span-4 relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-green-500/20 p-1.5 rounded-lg group-hover:bg-green-500/40 transition-colors">
                    <MessageCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <input
                    type="text"
                    value={dept.whatsappId}
                    onChange={(e) => updateDept(dept.id, 'whatsappId', e.target.value)}
                    placeholder="WhatsApp No / Grup ID"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                {/* Sil Butonu (Custom olanlar için) */}
                <div className="md:col-span-1 flex justify-center hidden md:flex">
                  {dept.id > 5 ? (
                    <button onClick={() => removeDept(dept.id)} className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors border border-red-500/20">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  ) : (
                    <div className="w-11 h-11" /> // Spacer
                  )}
                </div>

                {/* Çalışma Saatleri ve Günleri */}
                <div className="md:col-span-12 flex flex-col md:flex-row gap-4 items-start md:items-center bg-slate-900/80 rounded-xl p-4 border border-slate-800 mt-2">
                   <div className="flex items-center gap-2 text-sm text-slate-400 min-w-[150px]">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="font-bold">Çalışma Düzeni:</span>
                   </div>
                   
                   <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                     {/* Vardiya Seçimi */}
                     <select 
                        value={dept.shift} 
                        onChange={(e) => updateDept(dept.id, 'shift', e.target.value)} 
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 w-[140px] cursor-pointer"
                     >
                       {SHIFTS.map(shift => (
                         <option key={shift} value={shift}>{shift}</option>
                       ))}
                     </select>

                     {/* Gün Seçimi */}
                     <div className="flex flex-wrap gap-2">
                       {ALL_DAYS.map(day => {
                         const isActive = dept.workingDays.includes(day);
                         return (
                           <button
                             key={day}
                             onClick={() => toggleDay(dept.id, day)}
                             className={`text-xs px-2.5 py-1.5 rounded-md font-bold transition-all border ${
                               isActive 
                                ? 'bg-purple-600/30 text-purple-300 border-purple-500/50' 
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'
                             }`}
                           >
                             {day}
                           </button>
                         )
                       })}
                     </div>
                   </div>

                   {dept.id !== 1 && (
                     <div className="ml-auto text-xs font-bold text-amber-500/80 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20">
                       <span className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                         Mesai dışı otomatik yönlendirme: Resepsiyon
                       </span>
                     </div>
                   )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-center justify-between p-6 bg-purple-900/10 border border-purple-500/20 rounded-2xl">
            {/* Yeni Ekle */}
            <form onSubmit={addDept} className="flex gap-3 w-full sm:w-auto">
              <input 
                type="text" 
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="Yeni Departman Adı"
                className="bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-purple-500 flex-1"
              />
              <button disabled={!newDept.trim()} type="submit" className="bg-purple-600 disabled:bg-slate-800 disabled:text-slate-500 text-white p-3 rounded-xl hover:bg-purple-500 transition-colors shadow-lg">
                <Plus className="w-5 h-5" />
              </button>
            </form>

            <button onClick={handleSave} className="w-full sm:w-auto px-8 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2">
              <Save className="w-5 h-5" />
              KAYDET VE UYGULA
            </button>
          </div>

        </div>

        {/* Footer Info */}
        <div className="text-center">
          <p className="text-slate-500 text-sm font-medium">
            Değişikliklerin canlı bot servislerine (Telegram / WhatsApp) yansıması yaklaşık 30 saniye sürer.
          </p>
        </div>

      </div>
    </div>
  );
}
