// var obj = [
//     {
//         id : "test1",
//         weight : 30
//     },
//     {
//         id : "test2",
//         weight : 20
//     }
// ];
// console.log(obj.sort(function(a,b){if(a.weight > b.weight){return -1;}else{return 1;}}));  

(function(){
    var automationUtils = new discoveryAutomationUtils();
	var recGr = new GlideRecord('u_ip_network_processing_queue');
    recGr.addEncodedQuery('u_status=ready');
    recGr.setLimit(parseInt(automationUtils.getParams('ITOM Automation','networkDecodingBatchSize')));
	recGr.query();
    while(recGr.next()){ //Trigger Only Once, rest of the probes trigger in a sequential order after this, based on the BR on 'u_ip_network_processing_queue' table.
        automationUtils.getStartEndIPNetwork(recGr.u_network_ip,recGr.u_netmask,recGr.u_document_id,recGr.u_document_type,recGr.sys_id);
        recGr.setValue('u_status','queued');
        recGr.update();
	}
})();