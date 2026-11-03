import React from 'react';
import { BadgeCode, GamificationLevelNumber, StudentAvatarIconKey } from '../types';

/**
 * Original SVG Badge Icons for Specialized Study Gamification Engine.
 * Designed in Specialized Study palette: Primary Blue (#2563EB), Sky Blue (#38BDF8),
 * Silver (#94A3B8), and Subtle Gold (#F59E0B).
 */
export const GamificationBadgeSvg: React.FC<{
  code: BadgeCode;
  earned?: boolean;
  size?: number;
}> = ({ code, earned = true, size = 44 }) => {
  const primary = earned ? '#2563EB' : '#94A3B8';
  const accent = earned ? '#38BDF8' : '#CBD5E1';
  const gold = earned ? '#F59E0B' : '#CBD5E1';
  const bg = earned ? '#EFF6FF' : '#F8FAFC';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Hexagonal academic shield base */}
      <path
        d="M24 3L42 12.5V35.5L24 45L6 35.5V12.5L24 3Z"
        fill={bg}
        stroke={primary}
        strokeWidth="2.2"
      />
      <path
        d="M24 7L38 14.5V33.5L24 41L10 33.5V14.5L24 7Z"
        stroke={accent}
        strokeWidth="1.2"
        strokeDasharray="3 2"
      />

      {code === 'BIRINCHI_QADAM' && (
        <>
          <path
            d="M24 14L29 24H19L24 14Z"
            fill={primary}
          />
          <circle cx="24" cy="30" r="4" fill={gold} />
          <path d="M16 34H32" stroke={primary} strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {code === 'FAOL_OQUVCHI' && (
        <>
          <path
            d="M24 13L26.9 19.2L33.7 20.1L28.7 24.8L29.9 31.6L24 28.3L18.1 31.6L19.3 24.8L14.3 20.1L21.1 19.2L24 13Z"
            fill={gold}
            stroke={primary}
            strokeWidth="1.6"
          />
        </>
      )}

      {code === 'MATEMATIKA_IXLOSMANDI' && (
        <>
          <text
            x="24"
            y="29"
            textAnchor="middle"
            fill={primary}
            fontSize="18"
            fontWeight="800"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            ∑π
          </text>
          <circle cx="33" cy="16" r="3" fill={gold} />
        </>
      )}

      {code === 'IZCHILLIK' && (
        <>
          <path
            d="M25 13L17 25H24L22 35L31 22H24L25 13Z"
            fill={gold}
            stroke={primary}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </>
      )}

      {code === 'BILIM_IZLOVCHISI' && (
        <>
          <circle cx="24" cy="24" r="9" stroke={primary} strokeWidth="2" />
          <path d="M28 20L22 22L20 28L26 26L28 20Z" fill={gold} stroke={primary} strokeWidth="1.4" />
        </>
      )}

      {code === 'BIRINCHI_TEST' && (
        <>
          <rect x="16" y="14" width="16" height="20" rx="2.5" fill="white" stroke={primary} strokeWidth="2" />
          <path d="M20 24L23 27L29 20" stroke={gold} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {code === 'MASHGULOT_USTASI' && (
        <>
          <circle cx="24" cy="24" r="9" stroke={primary} strokeWidth="2" />
          <circle cx="24" cy="24" r="5" stroke={accent} strokeWidth="2" />
          <circle cx="24" cy="24" r="2.5" fill={gold} />
        </>
      )}
    </svg>
  );
};

export const StudentAvatarSvg: React.FC<{
  iconKey: StudentAvatarIconKey;
  size?: number;
}> = ({ iconKey = 'compass', size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      <rect width="56" height="56" rx="16" fill="#EFF6FF" />
      <rect x="1.5" y="1.5" width="53" height="53" rx="14.5" stroke="#BFDBFE" strokeWidth="1.5" />

      {iconKey === 'compass' && (
        <>
          <circle cx="28" cy="28" r="14" stroke="#2563EB" strokeWidth="2.5" />
          <path d="M34 22L25 25L22 34L31 31L34 22Z" fill="#38BDF8" stroke="#1D4ED8" strokeWidth="1.8" />
          <circle cx="28" cy="28" r="2.2" fill="#F59E0B" />
        </>
      )}

      {iconKey === 'orbit' && (
        <>
          <ellipse cx="28" cy="28" rx="16" ry="7" transform="rotate(-25 28 28)" stroke="#2563EB" strokeWidth="2.2" />
          <ellipse cx="28" cy="28" rx="16" ry="7" transform="rotate(35 28 28)" stroke="#38BDF8" strokeWidth="2.2" />
          <circle cx="28" cy="28" r="5" fill="#2563EB" />
          <circle cx="39" cy="21" r="2.5" fill="#F59E0B" />
        </>
      )}

      {iconKey === 'prism' && (
        <>
          <path d="M28 13L43 39H13L28 13Z" fill="#DBEAFE" stroke="#2563EB" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M28 13V39" stroke="#38BDF8" strokeWidth="2" />
          <circle cx="28" cy="24" r="3" fill="#F59E0B" />
        </>
      )}

      {iconKey === 'summit' && (
        <>
          <path d="M12 40L24 18L32 31L37 23L45 40H12Z" fill="#DBEAFE" stroke="#2563EB" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="37" cy="16" r="3.5" fill="#F59E0B" />
        </>
      )}

      {iconKey === 'stellar' && (
        <>
          <path
            d="M28 12L31.8 22.2L42 26L31.8 29.8L28 40L24.2 29.8L14 26L24.2 22.2L28 12Z"
            fill="#38BDF8"
            stroke="#2563EB"
            strokeWidth="2.2"
          />
          <circle cx="28" cy="26" r="3.2" fill="#F59E0B" />
        </>
      )}

      {iconKey === 'helix' && (
        <>
          <path d="M18 16C28 22 28 34 38 40" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M38 16C28 22 28 34 18 40" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="22" y1="21" x2="34" y2="21" stroke="#94A3B8" strokeWidth="2" />
          <line x1="22" y1="35" x2="34" y2="35" stroke="#94A3B8" strokeWidth="2" />
          <circle cx="28" cy="28" r="3" fill="#F59E0B" />
        </>
      )}

      {iconKey === 'vector' && (
        <>
          <path d="M16 38L38 16" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M29 16H38V25" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="38" r="4" fill="#38BDF8" stroke="#2563EB" strokeWidth="2" />
          <circle cx="27" cy="27" r="3" fill="#F59E0B" />
        </>
      )}

      {iconKey === 'quantum' && (
        <>
          <rect x="17" y="17" width="22" height="22" rx="5" transform="rotate(15 28 28)" stroke="#2563EB" strokeWidth="2.2" />
          <rect x="17" y="17" width="22" height="22" rx="5" transform="rotate(60 28 28)" stroke="#38BDF8" strokeWidth="2.2" />
          <circle cx="28" cy="28" r="4" fill="#F59E0B" />
        </>
      )}
    </svg>
  );
};

export const LevelCrestSvg: React.FC<{
  level: GamificationLevelNumber;
  size?: number;
}> = ({ level, size = 36 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      <path
        d="M20 3L35 9.5V21.5C35 29.8 28.6 35.8 20 38C11.4 35.8 5 29.8 5 21.5V9.5L20 3Z"
        fill="#EFF6FF"
        stroke="#2563EB"
        strokeWidth="2.2"
      />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fill="#1D4ED8"
        fontSize="15"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {level}
      </text>
    </svg>
  );
};

export const AVATAR_ICON_OPTIONS: { key: StudentAvatarIconKey; label: string }[] = [
  { key: 'compass', label: 'Kompas' },
  { key: 'orbit', label: 'Orbita' },
  { key: 'prism', label: 'Prizma' },
  { key: 'summit', label: "Cho'qqi" },
  { key: 'stellar', label: 'Yulduz' },
  { key: 'helix', label: 'Spiral' },
  { key: 'vector', label: 'Vektor' },
  { key: 'quantum', label: 'Kvant' },
];
