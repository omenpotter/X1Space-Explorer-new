import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Layout({ children, currentPageName }) {
  return (
    <>
      {/* Meta description for SEO */}
      <style>{`
        /* Social media icons */
        .social-link {
          transition: opacity 0.2s;
        }
        .social-link:hover {
          opacity: 0.8;
        }
      `}</style>
      
      {children}
      
      {/* Footer with social links */}
      <footer className="bg-[#1d2d3a] border-t border-white/5 py-4 mt-auto">
        <div className="max-w-[1800px] mx-auto px-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded flex items-center justify-center">
                <span className="text-black font-black text-xs">X1</span>
              </div>
              <span className="text-sm font-bold"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              <span className="text-gray-500 text-xs ml-2">© 2025-2026</span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Twitter/X */}
              <a 
                href="https://x.com/rkbehelvi" 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link text-gray-300 hover:text-white"
                aria-label="Follow us on X (Twitter)"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* Telegram */}
              <a 
                href="https://t.me/+HtiLywX2Dug3MjJk" 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link text-gray-300 hover:text-cyan-400"
                aria-label="Join us on Telegram"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}