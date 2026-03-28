// RYDZ Driver - Configuration
// Supabase credentials, logos, theme constants

// AGGRESSIVE RESET - clear ALL old data
try{
var vk='rydz-driver-v4b';
if(localStorage.getItem(vk)!=='done'){
localStorage.removeItem('rydz-db');
localStorage.removeItem('rydz-uid');
localStorage.removeItem('rydz-version');
localStorage.removeItem('rydz-driver-v4');
localStorage.setItem(vk,'done');
}
}catch(e){}

// === SUPABASE SYNC v4 ===

// Logos
var LOGO_LG='';
var LOGO_SM='';

// Vehicle options
var VEHS=[{id:'v1',name:'Vehicle 1',desc:'Gem Electric Shuttle'},{id:'v2',name:'Vehicle 2',desc:'Gem Electric Shuttle'},{id:'v3',name:'Vehicle 3',desc:'Gem Electric Shuttle'},{id:'v4',name:'Vehicle 4',desc:'Gem Electric Shuttle'}];

// Route dots SVG template
var RDOTS='<div class="route-dots"><div class="r-top"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg></div><div class="r-line"></div><div class="r-bot"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="1"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg></div></div>';

// Icon SVGs
var ICO_PIN='<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 5.5c0 3-3 5-3 5s-3-2-3-5a3 3 0 016 0z"/><circle cx="7" cy="5.5" r="1"/></svg>';
var ICO_FORK='<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 1v4a2 2 0 004 0V1M5 7v5M10 1v2a2 2 0 002 2 2 2 0 002-2V1M12 5v7"/></svg>';
var ICO_STAR='<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 1l1.4 2.8 3.1.5-2.2 2.2.5 3.1L6.5 8 3.7 9.6l.5-3.1L2 4.3l3.1-.5L6.5 1z"/></svg>';

// State variables
var DID=localStorage.getItem('rydz-drv-id')||'d1',db,selVeh=null,cur='load',crPU=null,crDO=null;
