// RYDZ Driver - Notifications
// Toast messages, alerts, status updates

function showToast(msg){var t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--nv);color:#fff;padding:14px 24px;border-radius:14px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,.25);opacity:0;transition:opacity .3s;max-width:320px;text-align:center';document.body.appendChild(t)}t.textContent=msg;t.style.opacity='1';setTimeout(function(){t.style.opacity='0'},3000)}
