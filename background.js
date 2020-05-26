var ip = 0;
var gR = new GlideRecord("discovery_schedule_range");
gR.addEncodedQuery('dscheduler.nameSTARTSWITHMgmt Range');
gR.query();
while(gR.next()){
    ip += parseInt(gR.range.getRefRecord().getValue('u_number_of_ips'));
}
gs.print(ip);

new discoveryAutomationUtils().calculateECCAgentClusterCoverage();