import React, { useState, useEffect, useRef } from 'react';
import { Settings, Smartphone, Truck, X, Save } from 'lucide-react';

// --- Configuration & Constants ---
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || '';
const WHATSAPP_NUMBER = "595991413975";
const API_BASE = '/api';

const COUNTRY_CODES = [
  { code: '55', emoji: '🇧🇷', label: 'Brasil' },
  { code: '595', emoji: '🇵🇾', label: 'Paraguai' },
];

const DELIVERY_OPTIONS = [
  { id: 'franco', label: 'Presidente Franco', fee: 0, subtitle: 'Grátis' },
  { id: 'lago', label: 'Região do Lago', fee: 0, subtitle: 'Grátis' },
  { id: 'km4', label: 'Região do Km4', fee: 5, subtitle: 'R$ 5,00' },
  { id: 'km7', label: 'Região do Km7', fee: 10, subtitle: 'R$ 10,00' },
];

// --- Helper Functions ---

// Fee Calculation Logic
const calcularTaxaServico = (valorBRL) => {
  if (valorBRL <= 250) return 10;
  if (valorBRL <= 1000) return 20;
  if (valorBRL <= 2000) return 30;
  return valorBRL * 0.015; // 1.5%
};

// Round to nearest 50,000 PYG
const arredondarParaNotas = (valorPYG) => {
  return Math.round(valorPYG / 50000) * 50000;
};

// Round to nearest 50 USD (notas de 50 e 100)
const arredondarParaNotasUSD = (valorUSD) => {
  return Math.round(valorUSD / 50) * 50;
};

// Formatting
const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatPYG = (val) => new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0 }).format(val);
const formatUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);

const parseCurrency = (str) => {
  if (!str) return 0;
  // Remove currency symbol, dots, replace comma with dot
  const clean = str.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};

// Helper to format currency input like 2.000,00
const formatCurrencyInput = (value) => {
  if (!value) return '';
  // Remove all non-numeric chars
  const numericValue = value.replace(/\D/g, '');
  if (!numericValue) return '';
  
  // Divide by 100 to get decimal places
  const floatValue = parseFloat(numericValue) / 100;
  
  // Format to BRL string (without currency symbol)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(floatValue);
};

// Helper to format PYG input (integer with thousand separators, e.g. 1.500.000)
const formatPygInput = (value) => {
  if (!value) return '';
  const numericValue = value.replace(/\D/g, '');
  if (!numericValue) return '';
  const intValue = parseInt(numericValue, 10) || 0;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(intValue);
};

// USD input: decimais 0,00 (mesmo estilo que BRL)
const formatUsdInput = (value) => {
  if (!value) return '';
  const numericValue = value.replace(/\D/g, '');
  if (!numericValue) return '';
  const floatValue = parseFloat(numericValue) / 100;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(floatValue);
};

export default function App() {
  // --- State ---
  const [ratePYG, setRatePYG] = useState(null);
  const [rateUSD, setRateUSD] = useState(null);
  const [updatedAtPyg, setUpdatedAtPyg] = useState('');
  const [updatedAtUsd, setUpdatedAtUsd] = useState('');
  const [rateLoading, setRateLoading] = useState(true);
  const [exchangeType, setExchangeType] = useState('pyg'); // 'pyg' | 'usd'

  const [brlInput, setBrlInput] = useState('');
  const [pygInput, setPygInput] = useState('');
  const [usdInput, setUsdInput] = useState('');

  // Delivery: 'franco' | 'lago' | 'km4' | 'km7'
  const [deliveryType, setDeliveryType] = useState('franco');

  // Calculated values for display
  const [finalPayBRL, setFinalPayBRL] = useState(0);
  const [finalReceivePYG, setFinalReceivePYG] = useState(0);
  const [finalReceiveUSD, setFinalReceiveUSD] = useState(0);
  const [fees, setFees] = useState(0);

  // Contato do cliente (para mensagem WhatsApp)
  const [contactCountryCode, setContactCountryCode] = useState('55');
  const [contactPhone, setContactPhone] = useState('');

  // Admin State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [newRatePygInput, setNewRatePygInput] = useState('');
  const [newRateUsdInput, setNewRateUsdInput] = useState('');

  const rate = exchangeType === 'pyg' ? ratePYG : rateUSD;
  const lastUpdate = exchangeType === 'pyg' ? updatedAtPyg : updatedAtUsd;

  // --- Effects ---

  // Carregar cotações PYG e USD (GET /api/cotacao)
  useEffect(() => {
    setRateLoading(true);
    fetch(`${API_BASE}/cotacao`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          setRatePYG(null);
          setRateUSD(null);
          setUpdatedAtPyg('');
          setUpdatedAtUsd('');
          return;
        }
        // Nova API: pyg, usd, updatedAtPyg, updatedAtUsd
        const pyg = typeof data.pyg === 'number' ? data.pyg : (typeof data.rate === 'number' ? data.rate : null);
        const usd = typeof data.usd === 'number' ? data.usd : null;
        setRatePYG(pyg);
        setRateUSD(usd);
        setUpdatedAtPyg(data.updatedAtPyg ? new Date(data.updatedAtPyg).toLocaleString() : (data.updatedAt ? new Date(data.updatedAt).toLocaleString() : ''));
        setUpdatedAtUsd(data.updatedAtUsd ? new Date(data.updatedAtUsd).toLocaleString() : '');
      })
      .catch(() => {
        setRatePYG(null);
        setRateUSD(null);
        setUpdatedAtPyg('');
        setUpdatedAtUsd('');
      })
      .finally(() => setRateLoading(false));
  }, []);

  // Travar scroll da página quando o modal Admin estiver aberto (card fixo no celular)
  useEffect(() => {
    if (isAdminOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isAdminOpen]);

  // Calculation Effect (PYG ou USD conforme exchangeType)
  useEffect(() => {
    const currentRate = exchangeType === 'pyg' ? ratePYG : rateUSD;
    const hasReceiveInput = exchangeType === 'pyg' ? !!pygInput : !!usdInput;

    if (!brlInput && !hasReceiveInput) {
      setFinalPayBRL(0);
      setFinalReceivePYG(0);
      setFinalReceiveUSD(0);
      setFees(0);
      return;
    }

    const deliveryOption = DELIVERY_OPTIONS.find((o) => o.id === deliveryType) || DELIVERY_OPTIONS[0];
    const deliveryFee = deliveryOption.fee;

    if (exchangeType === 'pyg' && currentRate != null) {
      if (brlInput && !pygInput) {
        const rawBrl = parseCurrency(brlInput);
        if (rawBrl === 0) return;
        let estimatedFee = calcularTaxaServico(rawBrl);
        let netBrl = rawBrl - estimatedFee - deliveryFee;
        if (netBrl < 0) netBrl = 0;
        let rawPyg = netBrl * currentRate;
        let roundedPyg = arredondarParaNotas(rawPyg);
        let exactNetBrl = roundedPyg / currentRate;
        let finalTotalBrl = exactNetBrl + deliveryFee;
        finalTotalBrl += calcularTaxaServico(finalTotalBrl);
        let finalFee = calcularTaxaServico(finalTotalBrl);
        finalTotalBrl = exactNetBrl + finalFee + deliveryFee;
        setFinalPayBRL(finalTotalBrl);
        setFinalReceivePYG(roundedPyg);
        setFinalReceiveUSD(0);
        setFees(finalFee);
      } else if (pygInput && !brlInput) {
        const rawPyg = parseCurrency(pygInput);
        if (rawPyg === 0) return;
        const roundedPyg = arredondarParaNotas(rawPyg);
        const netBrl = roundedPyg / currentRate;
        let totalBrl = netBrl + deliveryFee;
        totalBrl += calcularTaxaServico(totalBrl);
        const finalFee = calcularTaxaServico(totalBrl);
        totalBrl = netBrl + finalFee + deliveryFee;
        setFinalPayBRL(totalBrl);
        setFinalReceivePYG(roundedPyg);
        setFinalReceiveUSD(0);
        setFees(finalFee);
      }
      return;
    }

    // USD: cotação em R$/US$ (ex.: 5,50 = 1 USD custa 5,50 BRL). BRL→USD = BRL/rate; USD→BRL = USD*rate
    if (exchangeType === 'usd' && currentRate != null) {
      if (brlInput && !usdInput) {
        const rawBrl = parseCurrency(brlInput);
        if (rawBrl === 0) return;
        let estimatedFee = calcularTaxaServico(rawBrl);
        let netBrl = rawBrl - estimatedFee - deliveryFee;
        if (netBrl < 0) netBrl = 0;
        const rawUsd = netBrl / currentRate;
        const roundedUsd = arredondarParaNotasUSD(rawUsd);
        const exactNetBrl = roundedUsd * currentRate;
        let finalTotalBrl = exactNetBrl + deliveryFee;
        finalTotalBrl += calcularTaxaServico(finalTotalBrl);
        const finalFee = calcularTaxaServico(finalTotalBrl);
        finalTotalBrl = exactNetBrl + finalFee + deliveryFee;
        setFinalPayBRL(finalTotalBrl);
        setFinalReceivePYG(0);
        setFinalReceiveUSD(roundedUsd);
        setFees(finalFee);
      } else if (usdInput && !brlInput) {
        const rawUsd = parseCurrency(usdInput);
        if (rawUsd === 0) return;
        const roundedUsd = arredondarParaNotasUSD(rawUsd);
        const netBrl = roundedUsd * currentRate;
        let totalBrl = netBrl + deliveryFee;
        totalBrl += calcularTaxaServico(totalBrl);
        const finalFee = calcularTaxaServico(totalBrl);
        totalBrl = netBrl + finalFee + deliveryFee;
        setFinalPayBRL(totalBrl);
        setFinalReceivePYG(0);
        setFinalReceiveUSD(roundedUsd);
        setFees(finalFee);
      }
    }
  }, [brlInput, pygInput, usdInput, ratePYG, rateUSD, exchangeType, deliveryType]);


  // --- Handlers ---

  const handleBrlChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setBrlInput('');
      setPygInput('');
      setUsdInput('');
      return;
    }
    const cleanVal = val.replace(/\D/g, '');
    if (cleanVal === '') {
      setBrlInput('');
      setPygInput('');
      setUsdInput('');
      return;
    }
    setBrlInput(formatCurrencyInput(val));
    setPygInput('');
    setUsdInput('');
  };

  const handlePygChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setPygInput('');
      setBrlInput('');
      setUsdInput('');
      return;
    }
    setPygInput(formatPygInput(val));
    setBrlInput('');
    setUsdInput('');
  };

  const handleUsdChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setUsdInput('');
      setBrlInput('');
      setPygInput('');
      return;
    }
    setUsdInput(formatUsdInput(val));
    setBrlInput('');
    setPygInput('');
  };

  const handleAdminLogin = () => {
    if (adminPassInput === ADMIN_PASS) {
      setIsAuthenticated(true);
      setNewRatePygInput(ratePYG != null ? ratePYG.toString() : '');
      setNewRateUsdInput(rateUSD != null ? rateUSD.toString() : '');
    } else {
      alert("Senha incorreta!");
    }
  };

  const handleSaveRate = async () => {
    const pyg = newRatePygInput === '' ? null : parseFloat(String(newRatePygInput).replace(',', '.'));
    const usd = newRateUsdInput === '' ? null : parseFloat(String(newRateUsdInput).replace(',', '.'));
    const hasPyg = Number.isFinite(pyg) && pyg > 0;
    const hasUsd = Number.isFinite(usd) && usd > 0;
    if (!hasPyg && !hasUsd) return;

    try {
      const body = { password: adminPassInput };
      if (hasPyg) body.pyg = pyg;
      if (hasUsd) body.usd = usd;
      const res = await fetch(`${API_BASE}/cotacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        alert('Senha incorreta.');
        return;
      }
      if (!res.ok) {
        alert(data.error || 'Erro ao salvar cotação.');
        return;
      }

      if (data.pyg != null) {
        setRatePYG(data.pyg);
        setUpdatedAtPyg(data.updatedAtPyg ? new Date(data.updatedAtPyg).toLocaleString() : new Date().toLocaleString());
      }
      if (data.usd != null) {
        setRateUSD(data.usd);
        setUpdatedAtUsd(data.updatedAtUsd ? new Date(data.updatedAtUsd).toLocaleString() : new Date().toLocaleString());
      }
      setIsAdminOpen(false);
      setIsAuthenticated(false);
      setAdminPassInput('');
    } catch (err) {
      alert('Erro de conexão. Tente novamente.');
    }
  };

  // Formata contato para WhatsApp: (+5543999157589)
  const formatContactForWhatsApp = () => {
    const digits = (contactPhone || '').replace(/\D/g, '');
    if (!digits) return '—';
    return `(+${contactCountryCode}${digits})`;
  };

  // WhatsApp Link Generator (formato solicitado + Contato; Guaraní ou Dólar)
  const getWhatsAppLink = () => {
    const opt = DELIVERY_OPTIONS.find((o) => o.id === deliveryType) || DELIVERY_OPTIONS[0];
    const receiveText = exchangeType === 'pyg' ? formatPYG(finalReceivePYG) : formatUSD(finalReceiveUSD);
    const cotacaoText = exchangeType === 'pyg'
      ? `₲ ${ratePYG != null ? ratePYG : '—'}`
      : `US$ ${rateUSD != null ? rateUSD : '—'}`;
    const text = `Olá Leo!
Vou Trocar: ${formatBRL(finalPayBRL)}
*Vou Receber: ${receiveText}*
Cotação Atual: ${cotacaoText}
Taxas: ${formatBRL(fees)}
Entrega: ${opt.label} (${opt.fee === 0 ? 'Grátis' : formatBRL(opt.fee)})
Contato: ${formatContactForWhatsApp()}`;

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-cambio-bg text-white font-sans flex flex-col items-center px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-lg mx-auto">
      
      {/* --- Header: mobile first (empilha em telas pequenas) --- */}
      <header className="w-full flex flex-col gap-3 mb-4 relative">
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-[#2E7D32] to-[#1b5e20] rounded-xl flex items-center justify-center shadow-lg shadow-green-900/20">
              <span className="text-xl">💸</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">Leo Câmbios</h1>
              <p className="text-[10px] text-gray-500">BRL → PYG / USD</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAdminOpen(true)}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#1E1E1E]/50 border border-gray-800 text-gray-500 active:text-white active:bg-[#1E1E1E] transition-all"
            aria-label="Configurações Admin"
          >
            <Settings size={20} />
          </button>
        </div>
        {/* Cotação: escolha Guaraní ou Dólar; mostra valor ou Indisponível */}
        <div className="bg-[#1E1E1E] border border-[#2E7D32]/30 rounded-xl px-4 py-3 w-full space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-400">Cotação</span>
            <div className="flex items-center gap-2">
              {rateLoading ? (
                <span className="text-sm text-gray-500">Carregando…</span>
              ) : rate != null ? (
                <>
                  <span className="text-xl">{exchangeType === 'pyg' ? '🇵🇾' : '🇺🇸'}</span>
                  <span className="text-xl sm:text-2xl font-black text-[#2E7D32]">{rate}</span>
                  <span className="text-[10px] text-gray-500">{exchangeType === 'pyg' ? '₲/R$' : 'R$/US$'}</span>
                </>
              ) : (
                <span className="text-sm text-gray-500">Indisponível</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setExchangeType('pyg'); setBrlInput(''); setPygInput(''); setUsdInput(''); }}
              className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl border-2 text-sm font-bold transition-all touch-manipulation ${
                exchangeType === 'pyg' ? 'border-[#2E7D32] bg-[#2E7D32]/10 text-white' : 'border-gray-700 bg-[#0f0f0f] text-gray-400 active:border-gray-600'
              }`}
            >
              <span>🇵🇾</span>
              <span>Guaraní</span>
            </button>
            <button
              type="button"
              onClick={() => { setExchangeType('usd'); setBrlInput(''); setPygInput(''); setUsdInput(''); }}
              className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl border-2 text-sm font-bold transition-all touch-manipulation ${
                exchangeType === 'usd' ? 'border-[#2E7D32] bg-[#2E7D32]/10 text-white' : 'border-gray-700 bg-[#0f0f0f] text-gray-400 active:border-gray-600'
              }`}
            >
              <span>🇺🇸</span>
              <span>Dólar</span>
            </button>
          </div>
        </div>
        {lastUpdate && <p className="text-[9px] text-gray-600 text-right w-full">Atualizado {lastUpdate}</p>}
      </header>

      {/* --- Calculator: mobile first = 1 col, sm+ = 2 col --- */}
      <main className="w-full flex-1 space-y-3">
        
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#1E1E1E] border border-gray-800 rounded-2xl p-4 shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
            {/* BRL Input - altura mínima para toque --- */}
            <div className="relative">
              <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">Você paga (BRL)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={brlInput}
                  onChange={handleBrlChange}
                  placeholder="0,00"
                  className="w-full bg-[#0f0f0f] border-2 border-gray-800 focus:border-[#2E7D32] text-white text-base font-bold min-h-[48px] py-3 pl-12 pr-12 rounded-xl outline-none transition-all placeholder-gray-700"
                />
                {brlInput && (
                  <button onClick={() => { setBrlInput(''); setPygInput(''); setUsdInput(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 active:text-white active:bg-gray-800" aria-label="Limpar"><X size={18} /></button>
                )}
              </div>
            </div>
            {/* Receber: PYG ou USD conforme exchangeType */}
            <div className="relative">
              <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">
                Você recebe ({exchangeType === 'pyg' ? 'PYG' : 'USD'})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base">{exchangeType === 'pyg' ? '₲' : 'US$'}</span>
                {exchangeType === 'pyg' ? (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pygInput}
                      onChange={handlePygChange}
                      placeholder="0"
                      className="w-full bg-[#0f0f0f] border-2 border-gray-800 focus:border-[#2E7D32] text-white text-base font-bold min-h-[48px] py-3 pl-12 pr-12 rounded-xl outline-none transition-all placeholder-gray-700"
                    />
                    {pygInput && (
                      <button onClick={() => { setPygInput(''); setBrlInput(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 active:text-white active:bg-gray-800" aria-label="Limpar"><X size={18} /></button>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={usdInput}
                      onChange={handleUsdChange}
                      placeholder="0,00"
                      className="w-full bg-[#0f0f0f] border-2 border-gray-800 focus:border-[#2E7D32] text-white text-base font-bold min-h-[48px] py-3 pl-12 pr-12 rounded-xl outline-none transition-all placeholder-gray-700"
                    />
                    {usdInput && (
                      <button onClick={() => { setUsdInput(''); setBrlInput(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 active:text-white active:bg-gray-800" aria-label="Limpar"><X size={18} /></button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <p className="text-[9px] text-gray-600 mt-2 ml-1">
            {exchangeType === 'pyg' ? '* Arredondamento para notas 50k/100k' : exchangeType === 'usd' ? '* Arredondamento para notas de US$ 50/100' : ''}
          </p>
        </div>

        {/* Entrega: 4 opções, mesma estética */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#1E1E1E] border border-gray-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-[#2E7D32]" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entrega</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DELIVERY_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-xl border-2 cursor-pointer transition-all select-none touch-manipulation ${
                  deliveryType === opt.id ? 'border-[#2E7D32] bg-[#2E7D32]/10' : 'border-gray-800 bg-[#0f0f0f] active:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="delivery"
                  value={opt.id}
                  checked={deliveryType === opt.id}
                  onChange={() => setDeliveryType(opt.id)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${deliveryType === opt.id ? 'border-[#2E7D32] bg-[#2E7D32]' : 'border-gray-600'}`}>
                  {deliveryType === opt.id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-white block truncate">📍 {opt.label}</span>
                  <span className="text-[10px] text-gray-500">{opt.subtitle}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Resumo: sempre visível; cinza sem valor, vermelho/verde com valor --- */}
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#1E1E1E] border border-gray-800 rounded-2xl p-4 shadow-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {/* Você Paga: cinza sem valor, vermelho com valor */}
              <div className={`rounded-xl p-4 min-h-[60px] flex flex-col justify-center transition-colors ${
                finalPayBRL > 0 
                  ? 'bg-red-500/10 border border-red-500/20' 
                  : 'bg-[#0F0F0F] border border-gray-800'
              }`}>
                <span className={`text-[9px] font-bold uppercase ${
                  finalPayBRL > 0 ? 'text-red-400' : 'text-gray-500'
                }`}>Você Paga</span>
                <div className={`text-lg font-black ${
                  finalPayBRL > 0 ? 'text-white' : 'text-gray-500'
                }`}>
                  {finalPayBRL > 0 ? formatBRL(finalPayBRL) : 'R$ 0,00'}
                </div>
              </div>
              {/* Você Recebe: cinza sem valor, verde com valor (PYG ou USD) */}
              <div className={`rounded-xl p-4 min-h-[60px] flex flex-col justify-center transition-colors ${
                finalPayBRL > 0 
                  ? 'bg-[#2E7D32]/10 border border-[#2E7D32]/20' 
                  : 'bg-[#0F0F0F] border border-gray-800'
              }`}>
                <span className={`text-[9px] font-bold uppercase ${
                  finalPayBRL > 0 ? 'text-[#2E7D32]' : 'text-gray-500'
                }`}>Você Recebe</span>
                <div className={`text-lg font-black ${
                  finalPayBRL > 0 ? 'text-white' : 'text-gray-500'
                }`}>
                  {finalPayBRL > 0
                    ? (exchangeType === 'pyg' ? formatPYG(finalReceivePYG) : formatUSD(finalReceiveUSD))
                    : (exchangeType === 'pyg' ? '₲ 0' : 'US$ 0,00')}
                </div>
              </div>
            </div>
            <div className={`flex justify-between text-[10px] mb-3 ${
              finalPayBRL > 0 ? 'text-gray-500' : 'text-gray-600'
            }`}>
              <span>Taxa: {finalPayBRL > 0 ? formatBRL(fees) : '—'}</span>
              <span>Entrega: {finalPayBRL > 0 ? (DELIVERY_OPTIONS.find((o) => o.id === deliveryType)?.subtitle ?? '—') : '—'}</span>
            </div>
            {finalPayBRL > 0 && (
              <div className="mb-3">
                <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">Contato (telefone)</label>
                <div className="flex gap-2 mb-2">
                  {COUNTRY_CODES.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => setContactCountryCode(country.code)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl border-2 text-sm font-medium transition-all select-none touch-manipulation ${
                        contactCountryCode === country.code
                          ? 'border-[#2E7D32] bg-[#2E7D32]/10 text-white'
                          : 'border-gray-800 bg-[#0f0f0f] text-gray-400 active:border-gray-700'
                      }`}
                    >
                      <span className="text-lg">{country.emoji}</span>
                      <span>+{country.code}</span>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-base">+{contactCountryCode}</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder={contactCountryCode === '55' ? '99 99999-9999' : '991 123 456'}
                    className="w-full bg-[#0f0f0f] border-2 border-gray-800 focus:border-[#2E7D32] text-white text-base py-3 pl-14 pr-4 rounded-xl outline-none transition-all placeholder-gray-600"
                  />
                </div>
                <p className="text-[9px] text-gray-600 mt-1 ml-1">Será enviado como (+{contactCountryCode}…) na mensagem do WhatsApp</p>
              </div>
            )}
            {finalPayBRL > 0 ? (
              <a 
                href={getWhatsAppLink()} 
                target="_blank" 
                rel="noreferrer"
                className="w-full min-h-[48px] bg-[#25D366] active:bg-[#20bd5a] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] select-none touch-manipulation"
              >
                <Smartphone size={20} />
                Pedir no WhatsApp
              </a>
            ) : (
              <div className="w-full min-h-[48px] bg-[#0F0F0F] border border-gray-800 text-gray-500 font-bold py-3 rounded-xl flex items-center justify-center gap-2 select-none cursor-not-allowed">
                <Smartphone size={20} />
                Pedir no WhatsApp
              </div>
            )}
          </div>
        </div>

      </main>

      <footer className="mt-4 mb-2 text-center pb-[env(safe-area-inset-bottom)] space-y-1">
        <p className="text-[10px] text-gray-600">© 2026 Leo Câmbios</p>
        <p className="text-[10px]">
          <a 
            href="https://luizfilipe.com.br" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-gray-500 hover:text-[#2E7D32] transition-colors underline underline-offset-2"
          >
            Desenvolvido por luizfilipe.com.br
          </a>
        </p>
      </footer>

      {/* --- Admin Modal: mobile first (full width no celular) --- */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-lg p-0 sm:p-4 overflow-hidden animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#1E1E1E] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 border-2 border-gray-800 border-b-0 sm:border-b-2 shadow-2xl relative max-h-[90vh] overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom)] flex-shrink-0">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#2E7D32]/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[#2E7D32]/10 rounded-xl">
                      <Settings size={20} className="text-[#2E7D32]" />
                    </div>
                    <h2 className="text-2xl font-black text-white">Admin</h2>
                  </div>
                  <p className="text-xs text-gray-500">Área Administrativa</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAdminOpen(false);
                    setIsAuthenticated(false);
                    setAdminPassInput('');
                  }} 
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-gray-800/50 text-gray-400 active:text-white active:bg-gray-800 transition-all"
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>

              {!isAuthenticated ? (
                <div className="space-y-5">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-sm text-amber-200/80 flex items-center gap-2">
                      <span className="text-lg">🔒</span>
                      Digite a senha de administrador para acessar
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 ml-1 uppercase tracking-wider">
                      Senha de Acesso
                    </label>
                    <input 
                      type="password" 
                      value={adminPassInput}
                      onChange={(e) => setAdminPassInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                      placeholder="••••••••"
                      className="w-full bg-[#0f0f0f] border-2 border-gray-800 focus:border-[#2E7D32] text-white text-lg p-4 rounded-2xl outline-none transition-all placeholder-gray-700"
                      autoFocus
                    />
                  </div>

                  <button 
                    onClick={handleAdminLogin}
                    className="w-full min-h-[48px] bg-gradient-to-r from-[#2E7D32] to-[#1b5e20] active:from-[#1b5e20] active:to-[#2E7D32] text-white font-bold py-4 rounded-2xl transition-all duration-300 active:scale-[0.98] shadow-lg shadow-green-900/30 touch-manipulation"
                  >
                    Autenticar
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="bg-[#2E7D32]/10 border border-[#2E7D32]/20 rounded-xl p-4">
                    <p className="text-sm text-green-200/80 flex items-center gap-2">
                      <span className="text-lg">✓</span>
                      Acesso autorizado
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2 ml-1 uppercase tracking-wider">
                        Cotação PYG (₲/R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">₲</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={newRatePygInput}
                          onChange={(e) => setNewRatePygInput(e.target.value)}
                          placeholder="1450"
                          className="w-full bg-[#0f0f0f] border-2 border-gray-800 focus:border-[#2E7D32] text-white text-base sm:text-2xl font-bold p-4 pl-14 rounded-2xl outline-none transition-all placeholder-gray-700"
                        />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-2 ml-1">Atual: ₲ {ratePYG != null ? ratePYG : '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2 ml-1 uppercase tracking-wider">
                        Cotação USD (R$/US$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">US$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={newRateUsdInput}
                          onChange={(e) => setNewRateUsdInput(e.target.value)}
                          placeholder="5,50"
                          className="w-full bg-[#0f0f0f] border-2 border-gray-800 focus:border-[#2E7D32] text-white text-base sm:text-2xl font-bold p-4 pl-14 rounded-2xl outline-none transition-all placeholder-gray-700"
                        />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-2 ml-1">Atual: US$ {rateUSD != null ? rateUSD : '—'}</p>
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveRate}
                    className="w-full min-h-[48px] bg-gradient-to-r from-[#2E7D32] to-[#1b5e20] active:from-[#1b5e20] active:to-[#2E7D32] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] shadow-lg shadow-green-900/30 touch-manipulation"
                  >
                    <Save size={18} />
                    Salvar e Atualizar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
