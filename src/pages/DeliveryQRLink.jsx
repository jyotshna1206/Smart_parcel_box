import React, { useState, useRef, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  QrCode,
  Link as LinkIcon,
  Copy,
  Check,
  Download,
  Printer,
  Share2,
  Info,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Edit2
} from 'lucide-react';

export default function DeliveryQRLink() {
  // Configurable base URL: defaults to window.location.origin or stored IP
  const [baseUrl, setBaseUrl] = useState(() => {
    return localStorage.getItem('smart_locker_app_url') || window.location.origin;
  });
  const [editingUrl, setEditingUrl] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(baseUrl);
  const [copied, setCopied] = useState(false);
  const [shareSupported, setShareSupported] = useState(false);

  const qrCanvasRef = useRef(null);
  const printAreaRef = useRef(null);

  // Exact delivery access URL
  const deliveryUrl = `${baseUrl.replace(/\/$/, '')}/delivery-access`;

  useEffect(() => {
    setShareSupported(Boolean(navigator.share));
  }, []);

  const handleSaveBaseUrl = (e) => {
    e.preventDefault();
    const cleaned = customUrlInput.trim().replace(/\/$/, '');
    setBaseUrl(cleaned);
    localStorage.setItem('smart_locker_app_url', cleaned);
    setEditingUrl(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(deliveryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareViaNativeApps = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Smart Package Locker - Delivery Access',
          text: 'Please use this secure link to enter your delivery PIN and unlock the locker:',
          url: deliveryUrl
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      copyLink();
    }
  };

  const downloadQrCodePng = () => {
    const canvas = document.getElementById('delivery-qr-canvas');
    if (!canvas) return;

    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = 'smart-locker-delivery-qr.png';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const printPlacard = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Delivery Access QR & Shareable Link
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Provide delivery personnel with instant access to the PIN entry page via permanent physical QR code or shareable URL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={deliveryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition"
          >
            <span>Open Delivery Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Network Configuration Helper Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 shrink-0 mt-0.5">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono">
                Configured Delivery Access Base URL
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-0.5 select-all">
              {deliveryUrl}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              <strong>Testing Tip:</strong> If testing courier access from a smartphone on your local Wi-Fi, change <code className="text-blue-300">localhost</code> to your computer's local IP (e.g. <code className="text-blue-300">http://192.168.1.100:5173</code>) so your phone can reach the web page.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setCustomUrlInput(baseUrl);
            setEditingUrl(!editingUrl);
          }}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>{editingUrl ? 'Cancel Edit' : 'Change Base URL'}</span>
        </button>
      </div>

      {/* Base URL Edit Form */}
      {editingUrl && (
        <form onSubmit={handleSaveBaseUrl} className="p-4 bg-white rounded-2xl border border-blue-300 shadow-sm flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="http://192.168.1.100:5173 or https://your-domain.com"
            required
            className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
          >
            Save Base URL
          </button>
        </form>
      )}

      {/* Section Grid: QR Code (Left) & Shareable Link (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A. QR CODE SECTION */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>Physical QR Code Placard</span>
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Permanent QR
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Affix this QR code to the locker exterior. Delivery couriers simply scan it with their phone camera to instantly open the PIN entry portal.
            </p>

            {/* QR Code Canvas Frame */}
            <div className="flex justify-center my-6">
              <div className="p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-md flex flex-col items-center">
                <QRCodeCanvas
                  id="delivery-qr-canvas"
                  value={deliveryUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
                <span className="text-[10px] font-mono text-slate-400 mt-2">
                  Scan with Camera to Open Delivery Access
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={downloadQrCodePng}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                onClick={printPlacard}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Placard</span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-PIN Leakage:</strong> This QR code contains ONLY the URL. It NEVER contains the PIN, ensuring total security.
              </span>
            </div>
          </div>
        </div>

        {/* B. SHAREABLE LINK SECTION */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <span>Shareable Delivery Link</span>
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Web Link
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Include this link in delivery instructions on Amazon, Flipkart, FedEx, or courier delivery notes alongside the temporary PIN.
            </p>

            {/* URL Display and Copy Bar */}
            <div className="space-y-3 mb-6">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Full Public Access URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={deliveryUrl}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Share via messaging apps button */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <span className="text-xs font-bold text-slate-900 block">
                Instant Share to Courier
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Send the delivery URL directly through messaging apps (WhatsApp, SMS, Email) using native device sharing:
              </p>
              <button
                type="button"
                onClick={shareViaNativeApps}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Share Delivery Link via Messaging</span>
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Both the QR code and shareable link open the <strong>exact same</strong> PIN verification page. The delivery person enters their 6-digit PIN on this page to trigger unlocking.
            </span>
          </div>
        </div>
      </div>

      {/* Printable Placard Template (Visible when printing) */}
      <div id="print-placard-template" className="hidden print:block p-8 bg-white text-black font-sans">
        <div className="text-center border-4 border-black p-8 rounded-3xl max-w-lg mx-auto">
          <h1 className="text-2xl font-black uppercase tracking-tight">Smart Package Locker</h1>
          <p className="text-sm font-semibold mt-1">Contactless Package Delivery Station</p>
          
          <div className="my-8 flex justify-center">
            <QRCodeCanvas value={deliveryUrl} size={280} level="H" includeMargin={true} />
          </div>

          <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 text-left text-sm space-y-1">
            <p className="font-bold">Instructions for Courier:</p>
            <ol className="list-decimal list-inside text-xs space-y-1">
              <li>Scan the QR code above with your phone camera.</li>
              <li>Enter the 6-digit delivery PIN provided by the package recipient.</li>
              <li>Deposit the parcel and firmly close the locker door.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
