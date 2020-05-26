/*
{
    "impact": 3,
    "urgency": 2,
    "assignment_group": "SAP",
    "business_service": "IT Systems SRT",
    "category": "Hardware",
    "sub_category": "Monitoring",
    "resource1": {
      "mute": true,
      "impact": 4,
      "urgency": 2,
      "assignment_group": "SAP",
      "business_service": "IT Systems SRT",
      "warning_threshold": 40,
      "critical_threshold": 70
    },
    "resource2": {
      "mute": false,
      "impact": 2,
      "urgency": 2,
      "assignment_group": "IT Apps",
      "business_service": "IT Systems SRT",
      "warning_threshold": 40,
      "critical_threshold": 70
    },
    "resource3": {
      "mute": true,
      "impact": 2,
      "urgency": 2,
      "assignment_group": "ITOM Admin",
      "business_service": "IT Systems SRT",
      "warning_threshold": 40,
      "critical_threshold": 70
    },
    "resourcex": {
      "mute": false,
      "impact": 1,
      "urgency": 2,
      "assignment_group": "Network SRT",
      "business_service": "IT Systems SRT",
      "warning_threshold": 40,
      "critical_threshold": 70
    }
}


Zoom Quality Integration (Planned release 2/20):
Integration with Zoom API and Microsoft Graph API complete. Business logic to process notifications is in progress.

LogicMonitor Integration (March release)
JSON payload finalised and will be shared with LogicMonitor team.
POC will be starting tomorrow and share the results by mid next week.
CMDB Requirements were discussed and concluded.

MID Re-Architecture (Planned release on March)
Design has been finalised. 
Coding is in progress.

*/
//var ip = "10.10.0.0"; 00001010.00001010.00000000.00000000
//var wildcard = 00001010.00001010.00000001.11111111

var ip = "10.10.10.0";
var netmask = 23;
console.log(Math.pow(2,(32 - netmask)));

var staleBytes;
if(((32 - netmask) >= 24)){
  staleBytes = 3;
}
else if(((32 - netmask) >= 16)){
  staleBytes = 2;
}
else{
  console.log("Range is too big, not recommended for processing");
}

var fields = ip.split('.');
var bits = '';
for(i = 1; i <= staleBytes; i++){
  if(bits){
    bits += '.'+("00000000" + (parseInt(fields[i]).toString(2)).slice(-8));
  }
  else{
    bits += bits;
  }
}
console.log(bits);

/*
var ipaddr = "00000000000000000000000000000000";
console.log(ipaddr.slice(-netmask).concat((ipaddr.slice(netmask).replace(/0/g,1))));
console.log(ipaddr.slice(-netmask).concat((ipaddr.slice(netmask).replace(/0/g,1))));
*/