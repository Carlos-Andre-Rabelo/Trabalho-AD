import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { User, Mail, Shield, LogOut } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Perfil e Sessão</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Informações do usuário autenticado no sistema RU Metrics
        </p>
      </div>

      <Card className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black text-2xl uppercase shadow-md">
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{user.name}</h2>
            <p className="text-xs text-slate-500">{user.email}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
              <Shield className="w-3 h-3" /> Pesquisador / Coletor Autorizado
            </span>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-500 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" /> Identificador UUID
            </span>
            <span className="font-mono text-slate-800 text-[11px] truncate max-w-[200px]">{user.id}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-500 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" /> Email de Acesso
            </span>
            <span className="font-semibold text-slate-800">{user.email}</span>
          </div>
        </div>

        <div className="pt-2">
          <Button
            variant="danger"
            size="md"
            onClick={handleLogout}
            className="w-full gap-2 font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão no Dispositivo</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};
