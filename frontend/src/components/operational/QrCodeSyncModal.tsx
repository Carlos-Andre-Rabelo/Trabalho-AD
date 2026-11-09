import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { getNetworkInfo, NetworkInfo } from '../../api/network.js';
import { collectionsApi } from '../../api/collections.js';
import { Copy, Check, RefreshCw, Globe, Wifi, ExternalLink, Share2, Smartphone } from 'lucide-react';

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

  // Host mode: 'public' (origin), 'network' (local wifi IP), 'custom' (manual)
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isDeployPublic = isPublicHost(currentHostname);

  const [hostMode, setHostMode] = useState<'public' | 'network' | 'custom'>(() => {
    return isDeployPublic ? 'public' : 'network';
  });

  const [selectedIp, setSelectedIp] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');

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

  // Montagem da URL remota correta
  let computedBase = '';
  if (hostMode === 'public') {
    computedBase = typeof window !== 'undefined' ? window.location.origin : '';
  } else if (hostMode === 'custom') {
    if (customUrl.trim().startsWith('http://') || customUrl.trim().startsWith('https://')) {
      computedBase = customUrl.trim().replace(/\/$/, '');
    } else {
      const proto = window.location.protocol;
      computedBase = `${proto}//${customUrl.trim().replace(/\/$/, '')}`;
    }
  } else {
    // Modo rede local Wi-Fi
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const ip = selectedIp || 'localhost';
    computedBase = `${protocol}//${ip}${port}`;
  }

  const remoteUrl = `${computedBase}/coletas/${collectionId}/remoto${token ? `?token=${token}` : ''}`;

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

    // Fallback: abre no WhatsApp
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
              <span>{isDeployPublic ? 'Vercel / Nuvem' : 'URL Atual'}</span>
            </button>

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
              <strong>URL Web Pública:</strong> Funciona em qualquer lugar pelo 4G, 5G ou Wi-Fi. Ideal para uso publicado na Vercel.
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
                O celular e o computador devem estar conectados no mesmo Wi-Fi.
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
                onChange={(e) => setCustomUrl(e.target.value)}
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
