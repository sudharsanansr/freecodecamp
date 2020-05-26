(function(){
    var tables = ['discovery_range_item','discovery_range','discovery_schedule'];
    for(var i = 0; i < tables.length; i++){
        var gR = new GlideRecord(tables[i]);
        gR.addEncodedQuery('u_is_auto_discovered=true');
        gR.query();
        while(gR.next()){
            if(tables[i] == 'discovery_range_item'){
                var summary = gR.getValue('summary').replace('10.','40.');
                gR.setValue('summary',summary);
                var network_ip = gR.getValue('network_ip').replace('10.','40.')
                gR.setValue('network_ip',network_ip);
            }
            var name = gR.getValue('name').replace('10.','40.');
            gR.setValue('name',name);
            gR.setWorkflow(false);
            gR.update();
        }
    }  
})();

(function(){
    var tables = [/*'discovery_range_item','discovery_range',*/'discovery_schedule'];
    for(var i = 0; i < tables.length; i++){
        var gR = new GlideRecord(tables[i]);
        gR.addEncodedQuery('u_is_auto_discovered=true');
        gR.query();
        while(gR.next()){
            var name = gR.getValue('name').replace('Mgmt ','Default ');
            gR.setValue('name',name);
            gR.setWorkflow(false);
            gR.update();
        }
    }  
})();

(function(){
    var gR = new GlideRecord('u_ip_network_processing_queue');
    gR.query();
    while(gR.next()){
        var obj = JSON.parse(gR.getValue('u_payload_object'));
        var dsGr = new GlideRecord('discovery_schedule');
        dsGr.get(gR.getValue('u_document_id'));
        dsGr.setValue('u_start_ip_address_decimal',obj.firstIpDecimal);
        dsGr.setValue('u_end_ip_address_decimal',obj.lastIpDecimal);
        dsGr.setWorkflow(false);
        dsGr.update();
    }
})();


(function(){
    var ciGr = new GlideRecord('cmdb_ci_ip_switch');
    ciGr.addEncodedQuery('nameLIKEpdu^operational_status=1');
    ciGr.query();
    while(ciGr.next()){
        ciGr.deleteRecord();
    }
})();

