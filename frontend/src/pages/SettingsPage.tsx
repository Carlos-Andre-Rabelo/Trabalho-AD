import React, { useState } from 'react';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { BookOpen, Volume2, Smartphone, Save, Check } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('ru_pref_sound') !== 'false');
  const [hapticEnabled, setHapticEnabled] = useState(() => localStorage.getItem('ru_pref_haptic') !== 'false');
  const [defaultQueueMode, setDefaultQueueMode] = useState(() => localStorage.getItem('ru_pref_queue') || 'SEPARATE_QUEUES');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('ru_pref_sound', String(soundEnabled));
    localStorage.setItem('ru_pref_haptic', String(hapticEnabled));
    localStorage.setItem('ru_pref_queue', defaultQueueMode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Configurações & Metodologia</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Preferências de uso no dispositivo e documentação de fórmulas matemáticas do RU Metrics
        </p>
      </div>

      {/* Preferências Operacionais */}
      <Card>
        <h2 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-100 mb-4">
          Preferências de Feedback na Coleta
        </h2>

        <div className="space-y-4 text-xs">
          <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-slate-600" />
              <div>
                <span className="font-semibold text-slate-800 block">Feedback Sonoro (Beep)</span>
                <span className="text-slate-500">
                  Emite um clique acústico imediato ao registrar chegada ou entrega de proteína
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="rounded text-blue-900 focus:ring-blue-700 w-4 h-4"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-slate-600" />
              <div>
                <span className="font-semibold text-slate-800 block">Vibração Háptica no Celular</span>
                <span className="text-slate-500">
                  Pulso tátil de 40ms ao pressionar os botões em dispositivos móveis compatíveis
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={hapticEnabled}
              onChange={(e) => setHapticEnabled(e.target.checked)}
              className="rounded text-blue-900 focus:ring-blue-700 w-4 h-4"
            />
          </label>

          <div className="pt-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Modo de Fila Padrão para Novas Coletas
            </label>
            <select
              value={defaultQueueMode}
              onChange={(e) => setDefaultQueueMode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="SEPARATE_QUEUES">Filas Separadas (cada atendente com sua fila)</option>
              <option value="SINGLE_QUEUE">Fila Única Compartilhada</option>
              <option value="CUSTOM">Personalizada</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={handleSave} className="gap-2 bg-blue-900">
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saved ? 'Salvo com sucesso!' : 'Salvar Preferências'}</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Guia Metodológico e Fórmulas da Disciplina */}
      <Card>
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
          <BookOpen className="w-4 h-4 text-blue-700" />
          <h2 className="text-sm font-bold text-slate-800">
            Guia Metodológico de Avaliação de Desempenho (RU)
          </h2>
        </div>

        <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-1">1. Throughput (Vazão do Atendimento): X = N / T</h3>
            <p>
              Onde <strong>N</strong> é a quantidade de entregas válidas concluídas e <strong>T</strong> é o tempo
              operacional líquido (tempo total descontadas as pausas). O Throughput é calculado tanto por atendente
              quanto de forma agregada para a bancada.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-1">2. Taxa de Chegada: λ = A / T</h3>
            <p>
              Onde <strong>A</strong> é o número total de estudantes que chegam à fila durante o período de
              observação. Chegadas nunca devem ser deduzidas a partir das entregas, devendo ser registradas
              de forma independente.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-1">3. Lei de Little: L = λ · W</h3>
            <p>
              Em regime estável permanente, o número médio de estudantes no sistema (<strong>L</strong>) é igual à taxa
              média de chegada (<strong>λ</strong>) multiplicada pelo tempo médio no sistema (<strong>W</strong>).
              Se <strong>λ ≥ c·μ</strong> (onde <em>c</em> é o número de atendentes e <em>μ</em> a taxa de atendimento
              individual), o sistema entra em sobrecarga estocástica e a fila tende a crescer continuamente.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-1">4. Utilização do Atendente: U = B / T</h3>
            <p>
              Onde <strong>B</strong> é a soma da duração de atendimentos em que o atendente esteve ocupado, e{' '}
              <strong>T</strong> é o tempo operacional disponível. Ocupação alta não significa necessariamente
              produtividade sem controle da qualidade e do peso servido.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
