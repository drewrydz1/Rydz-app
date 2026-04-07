// RYDZ Rider - Sidebar (legacy stubs — sidebar replaced by bottom tab bar)

function openSB(){}
function closeSB(){}
function updSB(){
  // Update account tab avatar/name if present
  if(typeof curUser!=='undefined'&&curUser){
    var av=document.getElementById('acct-av');
    var nm=document.getElementById('acct-nm');
    var em=document.getElementById('acct-em');
    if(av)av.textContent=(curUser.firstName||curUser.name||'U')[0].toUpperCase();
    if(nm)nm.textContent=curUser.name||'—';
    if(em)em.textContent=curUser.email||'—';
  }
}
