import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { User, Check, Shield } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, userName, setUserName } = useAuth();
  const [nameInput, setNameInput] = useState(userName || user?.name || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setIsSaving(true);
    try {
      await setUserName(nameInput.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Identificação do Aferidor</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure o nome que será vinculado às suas aferições e registros operacionais
        </p>
      </div>

      <Card className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black text-2xl uppercase shadow-md">
            {userName?.charAt(0) || user?.name?.charAt(0) || 'A'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {userName || user?.name || 'Aferidor'}
            </h2>
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <Shield className="w-3 h-3 text-emerald-600" /> Acesso Livre sem Senha
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-700" />
              Seu Nome de Aferidor / Pesquisador *
            </label>
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ex.: Carlos Rabelo, Ana Beatriz..."
              className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700 font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Este nome será atribuído automaticamente a todas as novas coletas criadas neste dispositivo
            </p>
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Nome do aferidor atualizado com sucesso!</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
              className="font-bold px-6 bg-blue-900 hover:bg-blue-950"
            >
              Salvar Nome
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
