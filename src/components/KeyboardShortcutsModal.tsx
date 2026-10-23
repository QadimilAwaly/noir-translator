import React, { useEffect } from 'react';
import { X, Keyboard, Wand2, Sparkles, Plus, Save, ArrowRight, ArrowLeft, HelpCircle } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  badge?: string;
}

interface ShortcutGroup {
  category: string;
  icon: React.ReactNode;
  items: ShortcutItem[];
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutGroups: ShortcutGroup[] = [
    {
      category: 'Alur Penerjemahan (Workflow AI)',
      icon: <Wand2 className="w-4 h-4 text-indigo-400" />,
      items: [
        {
          keys: ['Ctrl', 'Enter'],
          description: 'Mulai menerjemahkan chapter aktif dengan AI',
          badge: 'Utama',
        },
        {
          keys: ['Alt', 'T'],
          description: 'Alternatif cepat untuk trigger Translate Chapter',
        },
        {
          keys: ['Alt', 'G'],
          description: 'Ekstrak istilah baru otomatis ke Glosarium',
          badge: 'Glosarium',
        },
        {
          keys: ['Ctrl', 'Shift', 'G'],
          description: 'Alternatif kombinasi untuk Ekstrak Glosarium',
        },
      ],
    },
    {
      category: 'Manajemen & Navigasi Chapter',
      icon: <Plus className="w-4 h-4 text-emerald-400" />,
      items: [
        {
          keys: ['Alt', 'N'],
          description: 'Buka modal Tambah Chapter Baru',
          badge: 'Chapter Baru',
        },
        {
          keys: ['Ctrl', 'S'],
          description: 'Simpan chapter aktif secara manual ke disk server',
          badge: 'Simpan',
        },
        {
          keys: ['Alt', '→'],
          description: 'Beralih ke Chapter selanjutnya (Next Chapter)',
        },
        {
          keys: ['Alt', '←'],
          description: 'Beralih ke Chapter sebelumnya (Prev Chapter)',
        },
      ],
    },
    {
      category: 'Bantuan & Dialog',
      icon: <HelpCircle className="w-4 h-4 text-amber-400" />,
      items: [
        {
          keys: ['?'],
          description: 'Buka atau tutup jendela bantuan shortcut keyboard ini',
        },
        {
          keys: ['Ctrl', '/'],
          description: 'Alternatif cepat untuk membuka jendela shortcut',
        },
        {
          keys: ['Esc'],
          description: 'Tutup modal / batal mode edit judul',
        },
        {
          keys: ['Ctrl', 'Enter'],
          description: 'Kirim / buat chapter langsung dari dalam form input bab',
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#16181D] border border-gray-800 rounded-xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0F1113]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                Pintasan Keyboard (Shortcuts)
              </h2>
              <p className="text-[11px] text-gray-500">
                Gunakan tombol cepat untuk mempercepat alur kerja penerjemahan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-5 text-xs">
          {shortcutGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-2">
              <div className="flex items-center gap-2 text-gray-300 font-semibold text-[11px] uppercase tracking-wider">
                {group.icon}
                <span>{group.category}</span>
              </div>
              <div className="bg-[#0F1113] border border-gray-800/80 rounded-lg divide-y divide-gray-800/60 overflow-hidden">
                {group.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="p-2.5 flex items-center justify-between gap-3 hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-300 truncate">{item.description}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 font-mono">
                      {item.keys.map((k, kIdx) => (
                        <React.Fragment key={kIdx}>
                          <kbd className="px-2 py-1 rounded bg-[#1A1D24] border border-gray-700/80 text-gray-200 text-[11px] font-bold shadow-sm">
                            {k}
                          </kbd>
                          {kIdx < item.keys.length - 1 && (
                            <span className="text-gray-500 text-xs font-sans">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#0F1113] border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-500">
          <span>Tekan <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300">Esc</kbd> untuk menutup</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-md transition-colors"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};
