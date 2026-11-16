import { useState } from 'react';
import { hashHue, initials } from '@/lib/format';
import { proxiedImageUrl } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { cn } from '@/lib/utils';

/**
 * Generated avatar: initials on a gradient derived from the address.
 * The same address always produces the same avatar. It is deliberately abstract
 * so it can never be mistaken for an official logo.
 */
/** @param {{ seed?: any, label?: any, size?: any, rounded?: any, className?: any, [key: string]: any }} props */
export function GeneratedAvatar({ seed, label, size = 36, rounded = 'full', className }) {
  const hue = hashHue(seed);
  const text = initials(label, seed);
  return (
    <span
      aria-hidden="true"
      data-avatar="generated"
      className={cn('inline-flex shrink-0 select-none items-center justify-center font-display font-semibold text-white/95 ring-1 ring-inset ring-white/10', rounded === 'full' ? 'rounded-full' : 'rounded-lg', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        background: `linear-gradient(135deg, hsl(${hue} 62% 42%), hsl(${(hue + 48) % 360} 68% 28%))`,
      }}
    >
      {text}
    </span>
  );
}

/** @param {{ src?: any, seed?: any, label?: any, size?: any, rounded?: any, className?: any, [key: string]: any }} props */
function ImageWithFallback({ src, seed, label, size, rounded, className }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) return <GeneratedAvatar seed={seed} label={label} size={size} rounded={rounded} className={className} />;
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      {/* The generated avatar stays underneath until the image has loaded, so there is never an empty box. */}
      {!loaded && <GeneratedAvatar seed={seed} label={label} size={size} rounded={rounded} className="absolute inset-0" />}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        data-avatar="image"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn('absolute inset-0 h-full w-full bg-surface-2 object-cover ring-1 ring-inset ring-white/10 transition-opacity duration-200', rounded === 'full' ? 'rounded-full' : 'rounded-lg', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </span>
  );
}

/**
 * Validator avatar. Uses the icon the operator published on chain (served through the
 * image proxy) and falls back to a generated avatar when there is none or it fails.
 */
/** @param {{ validator?: any, size?: any, className?: any, [key: string]: any }} props */
export function ValidatorAvatar({ validator, size = 36, className }) {
  const id = validator?.nodePubkey;
  const src = validator?.hasIcon && id ? proxiedImageUrl('validator', id) : null;
  return <ImageWithFallback src={src} seed={validator?.votePubkey || id} label={validator?.hasIdentity ? validator?.name : ''} size={size} rounded="full" className={className} />;
}

/** Token logo: trusted hosts load directly, anything else through the image proxy. */
/** @param {{ token?: any, size?: any, className?: any, [key: string]: any }} props */
export function TokenAvatar({ token, size = 32, className }) {
  let src = null;
  const url = token?.logoUrl || token?.imageUrl;
  if (url) {
    try {
      src = X1_CONFIG.directImageHosts.includes(new URL(url).hostname) ? url : proxiedImageUrl('token', token.mint);
    } catch {
      src = null;
    }
  }
  return <ImageWithFallback src={src} seed={token?.mint} label={token?.symbol || token?.name} size={size} rounded="full" className={className} />;
}
