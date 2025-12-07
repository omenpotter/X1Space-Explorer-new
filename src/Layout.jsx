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
                className="social-link text-gray-400 hover:text-white"
                aria-label="Follow us on X (Twitter)"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}