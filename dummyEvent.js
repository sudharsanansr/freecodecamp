var runit = function(){
    var gR = new GlideRecord("cmdb_ci_wap_network");
    gR.addEncodedQuery("operational_status=1^nameENDSWITHHYD11");
    gR.query();
    while(gR.next()){
        gs.sleep(1000);
        var additional_information = '{"action" : "incident","assignment_group" : "IT Network SRT","business_service" : " Wireless (Monitoring)","caller_id" : "MIST API","category" : "IT Business Services","evt_source" : "MIST","impact" : "3","location" : "HYD11","opened_by" : "Event Management","short_description" : "MIST Marvis event reported on AP WAP1-A5-AE2238-CHI004 for ap-down . Resolved status is True reason code is CLOUD-CONNECTION-LOSS","subcategory" : "Network","u_parent_business_service" : "Monitoring","urgency" : "1"}';
        var evtGr = new GlideRecord("em_event");
        evtGr.initialize();
        evtGr.setValue("source","MIST");
        evtGr.setValue("type","MIST API");
        evtGr.setValue("node",gR.getDisplayValue());
        evtGr.setValue("resource","ap-down");
        evtGr.setValue("metric_name","ap-down_HYD11");
        evtGr.setValue("severity","3");
        evtGr.setValue("message_key",gR.getDisplayValue()+"_MIST API_ap-down");
        evtGr.setValue("additional_info",additional_information);
        evtGr.insert();
    }
}

runit();


JSON.parse((alert.getValue("additional_info")).replace(/\//gi,"//"));