import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { getNetworkInfo, NetworkInfo } from '../../api/network.js';
import { collectionsApi } from '../../api/collections.js';
import {
  Copy,
  Check,
  RefreshCw,
  Globe,
  Wifi,
  ExternalLink,
  Share2,
  Smartphone,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';

export interface QrCodeSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionTitle?: string;
  initialToken?: string;
  connectedClientsCount?: number;
}

function isPublicHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  return true;
}

function isVercelDomain(hostname: string): boolean {
  return hostname.endsWith('.vercel.app');
}

function isVercelPreview(hostname: string): boolean {
  if (!isVercelDomain(hostname)) return false;
  return hostname.includes('-git-') || /-[a-z0-9]{8,}-/.test(hostname);
}

function getSuggestedProductionUrl(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (!isVercelPreview(url.hostname)) return null;

    const parts = url.hostname.split('.vercel.app')[0];
    const projectName = parts.split('-git-')[0].split(/-[a-z0-9]{9,}/)[0];
    if (projectName && projectName !== parts) {
      return `${url.protocol}//${projectName}.vercel.app`;
    }
  } catch {}
  return null;
}

export const QrCodeSyncModal: React.FC<QrCodeSyncModalProps> = ({
  isOpen,
  onClose,
  collectionId,
  initialToken,
  connectedClientsCount = 1,
}) => {
  const [token, setToken] = useState<string>(initialToken || '');
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [showVercelHelp, setShowVercelHelp] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isDeployPublic = isPublicHost(currentHostname);
  const isVercel = isVercelDomain(currentHostname);
  const suggestedProd = useMemo(() => getSuggestedProductionUrl(currentOrigin), [currentOrigin]);

  // Host mode: 'public' (origin), 'production' (canonical vercel), 'network' (local wifi IP), 'custom' (manual)
  const [hostMode, setHostMode] = useState<'public' | 'production' | 'network' | 'custom'>(() => {
    return isDeployPublic ? 'public' : 'network';
  });

  const [selectedIp, setSelectedIp] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>(() => {
    return localStorage.getItem('ru_custom_remote_url') || '';
  });

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function init() {
      try {
        const net = await getNetworkInfo();
        if (isMounted) {
          setNetworkInfo(net);
          if (net.primaryIp) {
            setSelectedIp(net.primaryIp);
          }
        }
      } catch {
        if (isMounted) {
          setSelectedIp('localhost');
        }
      }

      if (!token) {
        setIsLoadingToken(true);
        try {
          const res = await collectionsApi.getRemoteToken(collectionId);
          if (isMounted) setToken(res.token);
        } catch (e) {
          console.error('Falha ao obter remote token:', e);
        } finally {
          if (isMounted) setIsLoadingToken(false);
        }
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [isOpen, collectionId, token]);

  useEffect(() => {
    if (initialToken) setToken(initialToken);
  }, [initialToken]);

  const handleCustomUrlChange = (val: string) => {
    setCustomUrl(val);
    localStorage.setItem('ru_custom_remote_url', val);
  };

  // Extrai parâmetros de bypass da Vercel se existirem na URL atual do navegador
  const vercelBypassParams = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    const bypass: Record<string, string> = {};
    const share = params.get('_vercel_share');
    if (share) bypass['_vercel_share'] = share;
    const bypassToken = params.get('x-vercel-protection-bypass');
    if (bypassToken) bypass['x-vercel-protection-bypass'] = bypassToken;
    return bypass;
  }, []);

  // Montagem da URL remota correta
  let computedBase = '';
  if (hostMode === 'public') {
    computedBase = currentOrigin;
  } else if (hostMode === 'production' && suggestedProd) {
    computedBase = suggestedProd;
  } else if (hostMode === 'custom') {
    if (customUrl.trim().startsWith('http://') || customUrl.trim().startsWith('https://')) {
      computedBase = customUrl.trim().replace(/\/$/, '');
    } else if (customUrl.trim()) {
      const proto = window.location.protocol;
      computedBase = `${proto}//${customUrl.trim().replace(/\/$/, '')}`;
    } else {
      computedBase = currentOrigin;
    }
  } else {
    // Modo rede local Wi-Fi
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const ip = selectedIp || 'localhost';
    computedBase = `${protocol}//${ip}${port}`;
  }

  // Constrói URL com token do aferidor e parâmetros de bypass se houver
  const remoteUrlObj = useMemo(() => {
    try {
      const u = new URL(`${computedBase}/coletas/${collectionId}/remoto`);
      if (token) u.searchParams.set('token', token);
      for (const [k, v] of Object.entries(vercelBypassParams)) {
        u.searchParams.set(k, v);
      }
      return u.toString();
    } catch {
      return `${computedBase}/coletas/${collectionId}/remoto${token ? `?token=${token}` : ''}`;
    }
  }, [computedBase, collectionId, token, vercelBypassParams]);

  const remoteUrl = remoteUrlObj;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(remoteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareText = `Acesse a aferição simultânea do RU Metrics:\n${remoteUrl}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'RU Metrics - Aferição Simultânea',
          text: shareText,
          url: remoteUrl,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch {
        // Ignora cancelamento pelo usuário
      }
    }

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank');
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conectar Celular para Aferição Simultânea" maxWidth="md">
      <div className="space-y-4 text-xs text-slate-700">
        {/* Aviso de Conexão Ativa / Status */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-800">
              Aferição Remota e Simultânea
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {connectedClientsCount} conectado(s)
          </span>
        </div>

        {/* Alerta Específico se estiver na Vercel */}
        {isVercel && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Celular pedindo login da Vercel ao escanear?</span>
              </div>
              <button
                type="button"
                onClick={() => setShowVercelHelp(!showVercelHelp)}
                className="text-amber-800 hover:text-amber-950 font-semibold underline text-[11px] flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showVercelHelp ? 'Ocultar' : 'Como resolver'}</span>
              </button>
            </div>

            <p className="text-[11px] text-amber-800 leading-relaxed">
              A Vercel ativa proteção por padrão em URLs de teste/preview. No computador você já está logado, mas no celular a Vercel exige autenticação.
            </p>

            {showVercelHelp && (
              <div className="pt-2 border-t border-amber-200/80 space-y-1.5 text-[11px] text-amber-950">
                <p className="font-bold">Para liberar o acesso direto no celular (em 30 segundos):</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Abra o dashboard da <strong>Vercel</strong> e entre no projeto.</li>
                  <li>Clique na aba <strong>Settings</strong> e depois em <strong>Deployment Protection</strong>.</li>
                  <li>Na seção <strong>Vercel Authentication</strong>, mude para <strong>Disabled</strong> (Desativado) e salve.</li>
                </ol>
                <p className="text-[10px] text-amber-700 italic pt-1">
                  Feito isso, o QR Code abrirá direto a tela de registro de aferição no celular sem solicitar login.
                </p>
              </div>
            )}
          </div>
        )}

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-lg">
          {isLoadingToken ? (
            <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-[11px]">Gerando credencial de acesso...</span>
            </div>
          ) : (
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200">
              <QRCodeSVG value={remoteUrl} size={190} level="M" includeMargin />
            </div>
          )}

          <p className="mt-3 text-center text-[11px] text-slate-600 max-w-xs font-medium">
            Aponte a câmera do celular para o código QR para abrir a tela de operação e registrar chegadas/atendimentos em tempo real.
          </p>
        </div>

        {/* Seletor de Modo de Conexão */}
        <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <label className="block font-bold text-slate-800 mb-1">Origem da Conexão</label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => setHostMode('public')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium border transition-colors ${
                hostMode === 'public'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isDeployPublic ? 'URL Atual' : 'URL Atual'}</span>
            </button>

            {suggestedProd && (
              <button
                type="button"
                onClick={() => setHostMode('production')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium border transition-colors ${
                  hostMode === 'production'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title={`Usar domínio canônico de produção: ${suggestedProd}`}
              >
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                <span>Produção</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setHostMode('network')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium border transition-colors ${
                hostMode === 'network'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Wi-Fi Local</span>
            </button>

            <button
              type="button"
              onClick={() => setHostMode('custom')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium border transition-colors ${
                hostMode === 'custom'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <span>Personalizado</span>
            </button>
          </div>

          {hostMode === 'public' && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 leading-relaxed">
              <strong>URL Web Atual:</strong> Usa o mesmo domínio que você está acessando no computador ({currentHostname}).
            </div>
          )}

          {hostMode === 'production' && suggestedProd && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-900 leading-relaxed">
              <strong>Domínio Canônico de Produção:</strong> <code>{suggestedProd}</code>. Ideal caso a sua URL atual seja um preview temporário.
            </div>
          )}

          {hostMode === 'network' && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-slate-600">Selecione o IP do seu computador na rede Wi-Fi:</label>
              <select
                value={selectedIp}
                onChange={(e) => setSelectedIp(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono text-xs"
              >
                {networkInfo?.interfaces.map((iface, idx) => (
                  <option key={idx} value={iface.address}>
                    {iface.address} ({iface.name})
                  </option>
                ))}
                <option value="localhost">localhost (apenas neste dispositivo)</option>
              </select>
              <p className="text-[10px] text-slate-500">
                O celular e o computador devem estar conectados no mesmo Wi-Fi (usado para execução local).
              </p>
            </div>
          )}

          {hostMode === 'custom' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-600">Endereço público ou túnel (ex: https://meu-app.vercel.app):</label>
              <input
                type="text"
                placeholder="https://seu-dominio.vercel.app"
                value={customUrl}
                onChange={(e) => handleCustomUrlChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono text-xs"
              />
            </div>
          )}
        </div>

        {/* Campo com Link e Ações Rápidas */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              readOnly
              value={remoteUrl}
              className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50 font-mono text-xs text-slate-700 select-all"
            />
            <Button
              type="button"
              variant={copied ? 'success' : 'outline'}
              size="sm"
              onClick={handleCopyLink}
              className="gap-1 shrink-0"
              title="Copiar link"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{shared ? 'Compartilhado!' : 'Compartilhar WhatsApp'}</span>
              </Button>

              <a href={remoteUrl} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs text-slate-600">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Testar em nova aba</span>
                </Button>
              </a>
            </div>

            <Button type="button" variant="primary" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
