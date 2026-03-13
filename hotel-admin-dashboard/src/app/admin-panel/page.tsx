"use client";
import React, { useState, useEffect } from 'react';
import { ShieldCheck, MessageCircle, Send, Plus, Trash2, Users, Save, CheckCircle2, Settings, Clock, AlertTriangle, UserPlus } from 'lucide-react';
import Link from 'next/link';

export const ALL_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'];
export const SHIFTS = ['08:00 - 16:00', '16:00 - 00:00', '00:00 - 08:00', '08:00 - 18:00', '09:00 - 17:00', '7/24'];

type Contact = {
  id: number;
  name: string;
  telegramId: string;
  whatsappId: string;
};

type Department = {
  id: number;
  name: string;
  contacts: Contact[];
  offlineShifts: string[];
  offlineDays: string[];
  is24_7: boolean;
};

const newContact = (): Contact => ({
  id: Date.now() + Math.random(),
  name: '',
  telegramId: '',
  whatsappId: '',
});

export default function AdminPanel() {
  const [saved, setSaved] = useState(false);
  const [newDept, setNewDept] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([
    {
      id: 1, name: 'Resepsiyon (Ön Büro)', is24_7: true, offlineShifts: [], offlineDays: [],
      contacts: [{ id: 1, name: 'Resepsiyon Ana Hat', telegramId: '-419082348', whatsappId: '+905551234567' }],
    },
    {
      id: 2, name: 'Misafir İlişkileri (Guest Relation)', is24_7: true, offlineShifts: ['00:00 - 08:00'], offlineDays: [],
      contacts: [{ id: 2, name: 'Guest Relation', telegramId: '-412345678', whatsappId: '+905559876543' }],
    },
    {
      id: 3, name: 'Kat Hizmetleri (Housekeeping)', is24_7: true, offlineShifts: ['16:00 - 00:00', '00:00 - 08:00'], offlineDays: [],
      contacts: [{ id: 3, name: 'Housekeeping', telegramId: '', whatsappId: '' }],
    },
    {
      id: 4, name: 'Yiyecek & İçecek (F&B)', is24_7: true, offlineShifts: ['00:00 - 08:00'], offlineDays: [],
      contacts: [{ id: 4, name: 'F&B', telegramId: '', whatsappId: '' }],
    },
    {
      id: 5, name: 'Teknik Servis', is24_7: true, offlineShifts: ['16:00 - 00:00', '00:00 - 08:00'], offlineDays: ['Paz'],
      contacts: [{ id: 5, name: 'Teknik', telegramId: '', whatsappId: '' }],
    },
  ]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/departments?_t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        if (data.departments) {
          const loadedDeps = data.departments.map((d: any) => ({
            ...d,
            is24_7: d.is24_7 !== undefined ? d.is24_7 : true,
            offlineShifts: d.offlineShifts || [],
            offlineDays: d.offlineDays || [],
            contacts: d.contacts || []
          }));
          setDepartments(loadedDeps);
        }
      } catch (err) {
        console.error('Failed to load config:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ departments }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('Kaydetme hatası oluştu!');
    }
  };

  const updateDept = (id: number, field: keyof Department, value: any) => {
    setDepartments(departments.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  // --- Contact helpers ---
  const addContact = (deptId: number) => {
    setDepartments(departments.map(d =>
      d.id === deptId ? { ...d, contacts: [...d.contacts, newContact()] } : d
    ));
  };

  const removeContact = (deptId: number, contactId: number) => {
    setDepartments(departments.map(d =>
      d.id === deptId ? { ...d, contacts: d.contacts.filter(c => c.id !== contactId) } : d
    ));
  };

  const updateContact = (deptId: number, contactId: number, field: keyof Contact, value: string) => {
    setDepartments(departments.map(d =>
      d.id === deptId
        ? { ...d, contacts: d.contacts.map(c => c.id === contactId ? { ...c, [field]: value } : c) }
        : d
    ));
  };

  // --- Shift / Day helpers ---
  const toggleOfflineShift = (deptId: number, shift: string) => {
    setDepartments(departments.map(d => {
      if (d.id === deptId) {
        const shifts = d.offlineShifts.includes(shift)
          ? d.offlineShifts.filter(s => s !== shift)
          : [...d.offlineShifts, shift];
        return { ...d, offlineShifts: shifts };
      }
      return d;
    }));
  };

  const toggleOfflineDay = (deptId: number, day: string) => {
    setDepartments(departments.map(d => {
      if (d.id === deptId) {
        const days = d.offlineDays.includes(day)
          ? d.offlineDays.filter(dayName => dayName !== day)
          : [...d.offlineDays, day];
        return { ...d, offlineDays: days };
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
      contacts: [newContact()],
      offlineShifts: [],
      offlineDays: [],
      is24_7: true,
    }]);
    setNewDept('');
  };

  const removeDept = (id: number) => {
    setDepartments(departments.filter(d => d.id !== id));
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#0a0f1c] text-white flex items-center justify-center">Yükleniyor...</div>;
  }

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
              <p className="text-slate-400 font-medium mt-1">Özgür ÖZEN &amp; Kemal KUYUCU Özel Erişim Paneli</p>
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
                <Users className="w-6 h-6 text-purple-500" /> Departman Yönlendirme ID&apos;leri
              </h2>
              <p className="text-slate-400 text-sm max-w-2xl">
                Her departmana birden fazla sorumlu/çalışan ekleyebilirsiniz. Telegram Grup ID veya WhatsApp numarası ekleyin.
              </p>
            </div>
            {saved && (
              <span className="hidden md:flex items-center gap-2 text-sm font-bold text-green-400 bg-green-900/20 px-4 py-2 rounded-xl border border-green-500/30 animate-pulse">
                <CheckCircle2 className="w-4 h-4" />
                Başarıyla Kaydedildi
              </span>
            )}
          </div>

          <div className="space-y-6 mb-8">
            {departments.map((dept) => (
              <div key={dept.id} className="bg-slate-950/50 rounded-2xl border border-slate-800 hover:border-purple-500/30 transition-colors overflow-hidden">

                {/* Departman Başlık */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 bg-slate-900/40">
                  <span className="font-bold text-lg text-blue-100">{dept.name}</span>
                  <div className="flex items-center gap-2">
                    {dept.id > 5 && (
                      <button onClick={() => removeDept(dept.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Kişi Listesi */}
                  <div className="space-y-3">
                    {dept.contacts.map((contact, idx) => (
                      <div key={contact.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-900/60 rounded-xl p-3 border border-slate-800">

                        {/* Sıra numarası */}
                        <div className="sm:col-span-1 flex sm:flex-col items-center justify-center">
                          <span className="text-xs font-bold text-slate-500 bg-slate-800/80 w-7 h-7 rounded-full flex items-center justify-center">
                            {idx + 1}
                          </span>
                        </div>

                        {/* İsim */}
                        <div className="sm:col-span-3">
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) => updateContact(dept.id, contact.id, 'name', e.target.value)}
                            placeholder="Sorumlu / Grup adı"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                          />
                        </div>

                        {/* Telegram */}
                        <div className="sm:col-span-4 relative group">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-blue-500/20 p-1 rounded-md group-hover:bg-blue-500/40 transition-colors">
                            <Send className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <input
                            type="text"
                            value={contact.telegramId}
                            onChange={(e) => updateContact(dept.id, contact.id, 'telegramId', e.target.value)}
                            placeholder="Telegram Grup ID (-100...)"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>

                        {/* WhatsApp */}
                        <div className="sm:col-span-3 relative group">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-green-500/20 p-1 rounded-md group-hover:bg-green-500/40 transition-colors">
                            <MessageCircle className="w-3.5 h-3.5 text-green-400" />
                          </div>
                          <input
                            type="text"
                            value={contact.whatsappId}
                            onChange={(e) => updateContact(dept.id, contact.id, 'whatsappId', e.target.value)}
                            placeholder="WhatsApp No / Grup"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                          />
                        </div>

                        {/* Sil */}
                        <div className="sm:col-span-1 flex justify-center">
                          {dept.contacts.length > 1 ? (
                            <button
                              onClick={() => removeContact(dept.id, contact.id)}
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors"
                              title="Kişiyi Kaldır"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="w-9 h-9" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Kişi Ekle Butonu */}
                  <button
                    onClick={() => addContact(dept.id)}
                    className="flex items-center gap-2 text-xs font-bold text-purple-300 hover:text-white bg-purple-900/20 hover:bg-purple-600/30 border border-purple-700/40 hover:border-purple-500/60 px-4 py-2 rounded-lg transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    Sorumlu / Kişi Ekle
                  </button>

                  {/* Çalışma Düzeni */}
                  <div className="flex flex-col bg-slate-900/80 rounded-xl p-4 border border-slate-800 mt-2">
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-400 min-w-[150px]">
                        <Clock className="w-4 h-4 text-purple-400" />
                        <span className="font-bold">Çalışma Düzeni:</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => updateDept(dept.id, 'is24_7', true)}
                          className={`text-xs px-4 py-2 rounded-lg font-bold transition-all border ${
                            dept.is24_7
                              ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                              : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          Departmanda 7/24 çalışan var
                        </button>
                        <button
                          onClick={() => updateDept(dept.id, 'is24_7', false)}
                          className={`text-xs px-4 py-2 rounded-lg font-bold transition-all border ${
                            !dept.is24_7
                              ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                              : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          Belirli saat / günlerde OLMAMA durumu var
                        </button>
                      </div>
                    </div>

                    {!dept.is24_7 && (
                      <div className="flex flex-col gap-6 w-full pl-0 sm:pl-[148px] pt-4 border-t border-slate-800/50 mt-2">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-widest">
                            <AlertTriangle className="w-4 h-4" />
                            Yetkilinin OLMADIĞI (Kapalı) Vardiyalar:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {SHIFTS.filter(s => s !== '7/24').map(shift => {
                              const isActive = dept.offlineShifts.includes(shift);
                              return (
                                <button
                                  key={shift}
                                  onClick={() => toggleOfflineShift(dept.id, shift)}
                                  className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all border ${
                                    isActive
                                      ? 'bg-red-600/30 text-red-300 border-red-500/50'
                                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'
                                  }`}
                                >
                                  {shift}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-widest">
                            <AlertTriangle className="w-4 h-4" />
                            Yetkilinin OLMADIĞI (Tatil) Günler:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {ALL_DAYS.map(day => {
                              const isActive = dept.offlineDays.includes(day);
                              return (
                                <button
                                  key={day}
                                  onClick={() => toggleOfflineDay(dept.id, day)}
                                  className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all border ${
                                    isActive
                                      ? 'bg-red-600/30 text-red-300 border-red-500/50'
                                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {!dept.is24_7 && dept.id !== 1 && (
                      <div className="ml-auto text-xs font-bold text-amber-500/80 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20 mt-4">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          Mesai dışı otomatik yönlendirme: Resepsiyon
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-center justify-between p-6 bg-purple-900/10 border border-purple-500/20 rounded-2xl">
            {/* Yeni Departman Ekle */}
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
