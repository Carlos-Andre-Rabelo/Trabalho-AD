import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useConnectivity } from '../../context/ConnectivityContext.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Edit3, Plus } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, setUserName } = useAuth();
  const { isOnline, pendingCount } = useConnectivity();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user?.name || '');

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      await setUserName(tempName.trim());
      setIsEditingName(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-bold text-base text-slate-900 tracking-tight">
          RU Metrics
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink
            to="/coletas"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`
            }
          >
            Coletas
          </NavLink>
          <NavLink
            to="/coletas/nova"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-50'
              }`
            }
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Coleta</span>
          </NavLink>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {!isOnline && (
          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 font-medium">
            Offline ({pendingCount})
          </span>
        )}

        <button
          onClick={() => {
            setTempName(user?.name || '');
            setIsEditingName(true);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs text-slate-700"
          title="Alterar nome"
        >
          <span className="font-medium truncate max-w-[120px]">{user?.name || 'Aferidor'}</span>
          <Edit3 className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      <Modal
        isOpen={isEditingName}
        onClose={() => setIsEditingName(false)}
        title="Nome do Aferidor"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveName} className="space-y-3 text-xs">
          <input
            type="text"
            required
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            placeholder="Seu nome"
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingName(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </header>
  );
};
