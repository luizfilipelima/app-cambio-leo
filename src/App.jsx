import React, { useState, useEffect, useRef } from 'react';
import { Settings, Smartphone, Truck, X, Save } from 'lucide-react';

// --- Configuration & Constants ---
const DEFAULT_RATE = 1450; // Default fallback
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || '';
const WHATSAPP_NUMBER = "595991413975";

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

// Formatting
const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatPYG = (val) => new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0 }).format(val);

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

export default function App() {
  // --- State ---
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleString());
  
  const [brlInput, setBrlInput] = useState('');
  const [pygInput, setPygInput] = useState('');
  
  // Delivery: 'free' (Franco/Lago) or 'paid' (Outros +10)
  const [deliveryType, setDeliveryType] = useState('free');
  
  // Calculated values for display
  const [finalPayBRL, setFinalPayBRL] = useState(0);
  const [finalReceivePYG, setFinalReceivePYG] = useState(0);
  const [fees, setFees] = useState(0);
  
  // Admin State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [newRateInput, setNewRateInput] = useState('');

  // --- Effects ---

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedRate = localStorage.getItem('leo_cambios_rate');
    const savedTime = localStorage.getItem('leo_cambios_time');
    if (savedRate) setRate(parseFloat(savedRate));
    if (savedTime) setLastUpdate(savedTime);
  }, []);

  // Calculation Effect
  useEffect(() => {
    // If fields are empty, reset
    if (!brlInput && !pygInput) {
      setFinalPayBRL(0);
      setFinalReceivePYG(0);
      setFees(0);
      return;
    }

    const deliveryFee = deliveryType === 'paid' ? 10 : 0;

    // SCENARIO 1: User typed in BRL (Master)
    // We calculate the theoretical PYG, round it, then back-calculate the exact BRL needed.
    if (brlInput && !pygInput) {
      const rawBrl = parseCurrency(brlInput);
      if (rawBrl === 0) return;

      // 1. Initial Estimate of Fee
      let estimatedFee = calcularTaxaServico(rawBrl);
      
      // 2. Net Amount for Exchange
      let netBrl = rawBrl - estimatedFee - deliveryFee;
      if (netBrl < 0) netBrl = 0;

      // 3. Convert to PYG and Round
      let rawPyg = netBrl * rate;
      let roundedPyg = arredondarParaNotas(rawPyg);

      // 4. Reverse Calculate Exact BRL needed for this Rounded PYG
      let exactNetBrl = roundedPyg / rate;
      
      // 5. Re-calculate Fee based on new Total (Iterative approach to stabilize)
      // Total = Net + Fee(Total) + Delivery
      // We assume Fee is based on the Total Paid by customer.
      let finalTotalBrl = exactNetBrl + deliveryFee;
      
      // Add fee (first pass)
      finalTotalBrl += calcularTaxaServico(finalTotalBrl);
      
      // Check if bracket changed (second pass - usually enough)
      let finalFee = calcularTaxaServico(finalTotalBrl);
      finalTotalBrl = exactNetBrl + finalFee + deliveryFee;

      setFinalPayBRL(finalTotalBrl);
      setFinalReceivePYG(roundedPyg);
      setFees(finalFee);
    } 
    
    // SCENARIO 2: User typed in PYG (Master)
    else if (pygInput && !brlInput) {
      const rawPyg = parseCurrency(pygInput);
      if (rawPyg === 0) return;

      // 1. Round input immediately to valid notes
      const roundedPyg = arredondarParaNotas(rawPyg);
      
      // 2. Convert to Net BRL
      const netBrl = roundedPyg / rate;

      // 3. Calculate Total BRL required
      let totalBrl = netBrl + deliveryFee;
      // Add fee estimate
      totalBrl += calcularTaxaServico(totalBrl);
      // Re-calc fee on new total
      const finalFee = calcularTaxaServico(totalBrl);
      totalBrl = netBrl + finalFee + deliveryFee;

      setFinalPayBRL(totalBrl);
      setFinalReceivePYG(roundedPyg);
      setFees(finalFee);
    }

  }, [brlInput, pygInput, rate, deliveryType]);


  // --- Handlers ---

  const handleBrlChange = (e) => {
    let val = e.target.value;
    
    // If user is deleting and it becomes empty
    if (!val) {
      setBrlInput('');
      setPygInput('');
      return;
    }

    // Format the value as BRL currency
    // Check if the new value is a valid currency format or partial
    // Since we are formatting on change, we need to strip non-digits first
    const cleanVal = val.replace(/\D/g, '');
    
    if (cleanVal === '') {
      setBrlInput('');
      setPygInput('');
      return;
    }
    
    const floatVal = parseFloat(cleanVal) / 100;
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(floatVal);
    
    // Note: The Intl formatter includes "R$" sometimes or just the number depending on options.
    // The previous formatBRL uses style: 'currency', currency: 'BRL' which includes "R$".
    // Here we just want the number part like "2.000,00".
    // So we use default pt-BR number format which uses dots and commas.
    // But formatCurrencyInput above does exactly this if we don't specify currency style.
    // Wait, the new formatCurrencyInput function I added uses default NumberFormat which returns "2.000,00".
    
    // Wait, I should use the function I just added.
    // But I need to be careful with cursor position if I was implementing a full mask, 
    // but for this simple implementation, replacing the whole value is fine.
    
    // Let's reuse formatCurrencyInput logic here inline or call it if I made it available.
    // Since I added formatCurrencyInput outside component, I can use it.
    
    // However, there's a nuance: if I type "1", it becomes "0,01". 
    // If I type "12", it becomes "0,12".
    // This is the desired behavior for currency inputs often.
    
    // Let's implement this logic:
    const formattedValue = formatCurrencyInput(val);
    setBrlInput(formattedValue);
    setPygInput(''); // Clear other
  };

  const handlePygChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setPygInput('');
      setBrlInput('');
      return;
    }
    setPygInput(formatPygInput(val));
    setBrlInput('');
  };

  const handleAdminLogin = () => {
    if (adminPassInput === ADMIN_PASS) {
      setIsAuthenticated(true);
      setNewRateInput(rate.toString());
    } else {
      alert("Senha incorreta!");
    }
  };

  const handleSaveRate = () => {
    const newRate = parseFloat(newRateInput);
    if (newRate > 0) {
      setRate(newRate);
      const now = new Date().toLocaleString();
      setLastUpdate(now);
      localStorage.setItem('leo_cambios_rate', newRate);
      localStorage.setItem('leo_cambios_time', now);
      setIsAdminOpen(false);
      setIsAuthenticated(false);
      setAdminPassInput('');
    }
  };

  // WhatsApp Link Generator
  const getWhatsAppLink = () => {
    const text = `Olá Leo!
Vou Pagar: ${formatBRL(finalPayBRL)}
*Vou Receber: ${formatPYG(finalReceivePYG)}*
Cotação Atual: ₲ ${rate}
Taxas: ${formatBRL(fees)}
Entrega: ${deliveryType === 'free' ? 'Franco / Lago' : 'Outros Locais'}`;
    
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-[#0a0a0a] via-[#121212] to-[#1a1a1a] text-white font-sans flex flex-col items-center px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-lg mx-auto">
      
      {/* --- Header: mobile first (empilha em telas pequenas) --- */}
      <header className="w-full flex flex-col gap-3 mb-4 relative">
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-[#2E7D32] to-[#1b5e20] rounded-xl flex items-center justify-center shadow-lg shadow-green-900/20">
              <span className="text-xl">💸</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">Leo Câmbios</h1>
              <p className="text-[10px] text-gray-500">BRL → PYG</p>
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
        {/* Cotação: linha inteira no mobile --- */}
        <div className="flex items-center justify-between gap-2 bg-[#1E1E1E] border border-[#2E7D32]/30 rounded-xl px-4 py-3 w-full">
          <span className="text-sm text-gray-400">Cotação</span>
          <div className="flex items-center gap-2">
            <span className="text-xl">🇵🇾</span>
            <span className="text-xl sm:text-2xl font-black text-[#2E7D32]">{rate}</span>
            <span className="text-[10px] text-gray-500">₲/R$</span>
          </div>
        </div>
        <p className="text-[9px] text-gray-600 text-right w-full">Atualizado {lastUpdate}</p>
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
                  <button onClick={() => { setBrlInput(''); setPygInput(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 active:text-white active:bg-gray-800" aria-label="Limpar"><X size={18} /></button>
                )}
              </div>
            </div>
            {/* PYG Input --- */}
            <div className="relative">
              <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">Você recebe (PYG)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base">₲</span>
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
              </div>
            </div>
          </div>
          <p className="text-[9px] text-gray-600 mt-2 ml-1">* Arredondamento para notas 50k/100k</p>
        </div>

        {/* Entrega: mobile first 1 col, sm 2 col; alvo de toque >= 48px */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#1E1E1E] border border-gray-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-[#2E7D32]" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entrega</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-xl border-2 cursor-pointer transition-all select-none touch-manipulation ${
              deliveryType === 'free' ? 'border-[#2E7D32] bg-[#2E7D32]/10' : 'border-gray-800 bg-[#0f0f0f] active:border-gray-700'
            }`}>
              <input type="radio" name="delivery" value="free" checked={deliveryType === 'free'} onChange={() => setDeliveryType('free')} className="sr-only" />
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${deliveryType === 'free' ? 'border-[#2E7D32] bg-[#2E7D32]' : 'border-gray-600'}`}>
                {deliveryType === 'free' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-white block">📍 Franco / Lago</span>
                <span className="text-[10px] text-gray-500">Grátis</span>
              </div>
            </label>
            <label className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-xl border-2 cursor-pointer transition-all select-none touch-manipulation ${
              deliveryType === 'paid' ? 'border-[#2E7D32] bg-[#2E7D32]/10' : 'border-gray-800 bg-[#0f0f0f] active:border-gray-700'
            }`}>
              <input type="radio" name="delivery" value="paid" checked={deliveryType === 'paid'} onChange={() => setDeliveryType('paid')} className="sr-only" />
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${deliveryType === 'paid' ? 'border-[#2E7D32] bg-[#2E7D32]' : 'border-gray-600'}`}>
                {deliveryType === 'paid' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-white block">🚚 Outros Locais</span>
                <span className="text-[10px] text-gray-500">+R$ 10</span>
              </div>
            </label>
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
              {/* Você Recebe: cinza sem valor, verde com valor */}
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
                  {finalPayBRL > 0 ? formatPYG(finalReceivePYG) : '₲ 0'}
                </div>
              </div>
            </div>
            <div className={`flex justify-between text-[10px] mb-3 ${
              finalPayBRL > 0 ? 'text-gray-500' : 'text-gray-600'
            }`}>
              <span>Taxa: {finalPayBRL > 0 ? formatBRL(fees) : '—'}</span>
              <span>Entrega: {finalPayBRL > 0 ? (deliveryType === 'paid' ? 'R$ 10' : 'Grátis') : '—'}</span>
            </div>
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

      <footer className="mt-4 mb-2 text-center pb-[env(safe-area-inset-bottom)]">
        <p className="text-[10px] text-gray-600">© 2026 Leo Câmbios</p>
      </footer>

      {/* --- Admin Modal: mobile first (full width no celular) --- */}
      {isAdminOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#1E1E1E] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 border-2 border-gray-800 border-b-0 sm:border-b-2 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
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

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 ml-1 uppercase tracking-wider">
                      Nova Cotação (₲ PYG)
                    </label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">
                        ₲
                      </span>
                      <input 
                        type="number" 
                        value={newRateInput}
                        onChange={(e) => setNewRateInput(e.target.value)}
                        placeholder="1450"
                        className="w-full bg-[#0f0f0f] border-2 border-gray-800 focus:border-[#2E7D32] text-white text-base sm:text-2xl font-bold p-4 pl-14 rounded-2xl outline-none transition-all placeholder-gray-700"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-2 ml-1">
                      Valor atual: ₲ {rate}
                    </p>
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
