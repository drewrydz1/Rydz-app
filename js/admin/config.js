// RYDZ Admin - Configuration
// Uses shared config, aliases for backward compat

var SUPA = SUPA_URL;
var KEY = SUPA_KEY;

var SVC=[{lat:26.17319345750562,lng:-81.81783943525166},{lat:26.093442909425136,lng:-81.80448104553827},{lat:26.092372283380186,lng:-81.80077692007605},{lat:26.09926039070288,lng:-81.78703595420656},{lat:26.104399080347548,lng:-81.78643988281546},{lat:26.115518792417305,lng:-81.78735693740616},{lat:26.126509216803697,lng:-81.77854499304347},{lat:26.138794565452926,lng:-81.77869523447562},{lat:26.142762589023363,lng:-81.7848211566605},{lat:26.169933772476142,lng:-81.78606141667692},{lat:26.171154572849133,lng:-81.79207471929068},{lat:26.17319345750562,lng:-81.81783943525166}];
var NC={lat:26.1334,lng:-81.7935};
var MS=[{elementType:'geometry',stylers:[{color:'#1a1f2a'}]},{elementType:'labels.text.fill',stylers:[{color:'#6b7280'}]},{elementType:'labels.text.stroke',stylers:[{color:'#1a1f2a'}]},{featureType:'road',elementType:'geometry',stylers:[{color:'#2a3040'}]},{featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#1f2533'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#0f1319'}]},{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]}];

var admin=null,users=[],rides=[],tickets=[],adminAccts=[],fmap=null,dMk={},rMk={};
var isSuperAdmin=false;
