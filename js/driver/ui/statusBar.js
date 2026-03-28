// RYDZ Driver - Status Bar
// Online/offline toggle, header updates

async function togOn(){
var isOn=localStorage.getItem('rydz-drv-online')==='true';
var newStatus=isOn?false:true;
localStorage.setItem('rydz-drv-online',newStatus?'true':'false');
var d=gD();
if(d){d.status=newStatus?'online':'offline';await sv();supaUpdateUser(d)}
if(newStatus){startGPS()}else{stopGPS()}
ren()
}
