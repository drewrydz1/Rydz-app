// RYDZ Admin - Initialization

function heartbeat(){if(admin&&admin.id!=='local')api('PATCH','admin_users','?id=eq.'+admin.id,{last_seen:new Date().toISOString(),is_online:true})}

// INIT
(function(){var fl=document.createElement('link');fl.rel='stylesheet';fl.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap';document.head.appendChild(fl);checkSession()})();
