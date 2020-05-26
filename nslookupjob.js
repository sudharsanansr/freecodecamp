(function(){
	var automationUtils = new global.ITSRTCommonUtils();
	var ciExtensions = automationUtils.getRequestParams('ITOM Automation','nslookupExtensionsNetGear');
	var probeId = /*automationUtils.getRequestParams('ITOM Automation','nslookupProbeId');*/ '9fb5f220c31321003e76741e81d3ae95';
	var eccAgentId = /*automationUtils.getRequestParams('ITOM Automation','nslookupEccAgentId');*/ 'azure_mid_surftemp2';
	var sourceIP = /*automationUtils.getRequestParams('ITOM Automation','nslookupSourceIP')*/ '10.227.31.7';
	var ciName = '';
	var ciGr = new GlideRecord('cmdb_ci_netgear');
	ciGr.addEncodedQuery('sys_class_nameIN'+ciExtensions+'^operational_status=1');
	ciGr.setLimit(5);
	ciGr.query();
	while(ciGr.next()){
		ciName = ciGr.getValue('name');
		if(global.JSUtil.notNil(ciName)){
			generateECCEntryForNameServerLookup(ciName,ciGr.getUniqueValue());
		}
		else{
			gs.error('ITOM :: NSLookup Automation :: CI does not have name with id '+ciGr.getUniqueValue());
		}
	}
	
	function generateECCEntryForNameServerLookup(host,id){
		var eccGr = new GlideRecord('ecc_queue');
		eccGr.initialize();
		var text = '<?xml version="1.0" encoding="UTF-8"?><parameters><parameter name="hostname" value="$$host$$"/><parameter name="used_by_runbook" value="true"/><parameter name="used_by_discovery" value="true"/><parameter name="probe_name" value="DNS Lookup"/><parameter name="ci_sysid" value="$$ci_id$$"/><parameter name="probe" value="9fb5f220c31321003e76741e81d3ae95"/></parameters>';
		text = text.replace('$$host$$',host);
		text = text.replace('$$ci_id$$',id);
		text = text.replace('$$probe_id$$',probeId);
		eccGr.setValue('payload',text);
		eccGr.setValue('topic','DNSLookupProbe');
		eccGr.setValue('agent','mid.server.'+eccAgentId);
		eccGr.setValue('queue','output');
		eccGr.setValue('state','ready');
		eccGr.setValue('source',sourceIP);
		eccGr.insert();
	}
})();

(function(){
    var classes = new global.ITSRTCommonUtils().getRequestParams('ITOM Automation','nslookupExtensionsNetGear').toString().split(',');
    for(var i = 0; i < classes.length; i++){
        var ciGr = new GlideRecord(classes[i]);
        ciGr.addEncodedQuery('operational_status=1');
        ciGr.query();
        while(ciGr.next()){
            ciGr.setValue('u_ip_manual_address','');
            ciGr.setWorkflow(false);
            ciGr.update();
        }
    }
})();

https://surftemp2.service-now.com/cmdb_ci_netgear_list.do?sysparm_query=operational_status%3D1%5Eu_ip_manual_addressISNOTEMPTY%5Esys_class_name%3Dcmdb_ci_ip_router%5EORsys_class_name%3Dcmdb_ci_ip_switch&sysparm_view=