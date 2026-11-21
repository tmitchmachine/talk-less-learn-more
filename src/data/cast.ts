import type { Look } from '../art/draw';

export interface CastMember { name: string; look: Look }

export const CAST: Record<string, CastMember> = {
  player: { name: 'You', look: { skin: '#d6a27a', hair: '#3b2a20', shirt: '#e6b84a', pants: '#2d3a5a', style: 'cap', cap: '#c8463a' } },
  mae: { name: 'Mae', look: { skin: '#6b4430', hair: '#e4e1da', shirt: '#7a3e8e', pants: '#3a3550', style: 'bun', glasses: true } },
  rosa: { name: 'Rosa', look: { skin: '#b97a4e', hair: '#2a1a12', shirt: '#2f7a6b', pants: '#3a3550', style: 'bun' } },
  theo: { name: 'Theo', look: { skin: '#e1b48e', hair: '#7a4b2a', shirt: '#3b4f9a', pants: '#3b3a40', style: 'short', glasses: true } },
  priya: { name: 'Priya', look: { skin: '#8c5a3c', hair: '#141010', shirt: '#b5493c', pants: '#2b2f3a', style: 'long' } },
  jordan: { name: 'Jordan', look: { skin: '#f0c9a0', hair: '#d9a441', shirt: '#555b6e', pants: '#2b2f3a', style: 'spiky' } },
  gus: { name: 'Gus', look: { skin: '#9c6b4a', hair: '#5a4a3a', shirt: '#4f7d3a', pants: '#5a4632', style: 'bald' } },
  ivy: { name: 'Ivy', look: { skin: '#f2d0b0', hair: '#b5462a', shirt: '#3a6fb0', pants: '#2b2f3a', style: 'long' } },
  pete: { name: 'Pete', look: { skin: '#c48e66', hair: '#d8d8d8', shirt: '#8a5a3a', pants: '#4a4a55', style: 'short' } },
  nia: { name: 'Nia', look: { skin: '#7b4a2e', hair: '#1f1a17', shirt: '#e0544a', pants: '#33405a', style: 'spiky' } },
};
