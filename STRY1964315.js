function runThis(){
    var rangeItem = new GlideRecord('discovery_range_item');
    rangeItem.addEncodedQuery('active=true');
    rangeItem.query();
    while(rangeItem.next()){
        var totalIP = 0;
        var excludeIP = 0;
        var exclusionSet = 0;
        var type = rangeItem.getValue('type');
        var id = rangeItem.getUniqueValue();
        var obj = {};
        var exclusionDepthObj = {};

        if(type == 'IP Network'){
            //obj = {};
            obj.network_ip = rangeItem.getValue('network_ip');
            obj.netmask = rangeItem.getValue('netmask');
            totalIP = calculateIPDepth(type, obj);
        }
        else if(type == 'IP Address List'){
            //obj = {};
            obj.table = 'discovery_range_item_ip';
            obj.query =  'item_parent='+id.toString();
            totalIP = calculateIPDepth(type, obj);
        }
        else if(type == 'IP Address Range'){
            //obj = {};
            obj.startAddr = rangeItem.getValue('start_ip_address');
            obj.endAddr = rangeItem.getValue('end_ip_address');
            totalIP = calculateIPDepth(type, obj);
        }
        else{
            gs.error('Unidentified range item (discovery_range_item) record found, ID is :: '+id);
        }

        var exclusionObj = {};
        exclusionObj.table = 'discovery_range_item_exclude';
        exclusionObj.query = 'parent='+id.toString();
        exclusionSet = calculateIPDepth('IP Address List', exclusionObj);

        if(exclusionSet > 0){
            var exclusionList = new GlideRecord('discovery_range_item_exclude');
            exclusionList.addEncodedQuery('parent='+id);
            exclusionList.query();
            while(exclusionList.next()){
                var exclusionType = exclusionList.getValue('type');
                if(exclusionType == 'IP Network'){
                   //exclusionDepthObj = {};
                    exclusionDepthObj.network_ip = exclusionList.getValue('network_ip');
                    exclusionDepthObj.netmask = exclusionList.getValue('netmask');
                    excludeIP += calculateIPDepth(exclusionType,exclusionDepthObj);
                }
                else if(exclusionType == 'IP Address List'){
                    //exclusionDepthObj = {};
                    exclusionDepthObj.table = 'discovery_range_item_ip';
                    exclusionDepthObj.query =  'exclude_parent='+exclusionList.getUniqueValue().toString();
                    excludeIP += calculateIPDepth(exclusionType,exclusionDepthObj);
                }
                else if(exclusionType == 'IP Address Range'){
                    //exclusionDepthObj = {};
                    exclusionDepthObj.startAddr = exclusionList.getValue('start_ip_address');
                    exclusionDepthObj.endAddr = exclusionList.getValue('end_ip_address');
                    excludeIP += calculateIPDepth(exclusionType, obj);
                }
            }
            totalIP = totalIP - excludeIP;
        }

        rangeItem.setValue('u_number_of_ips',totalIP);
        rangeItem.setWorkflow(false);
        rangeItem.update();
    }
    
    calculateRangeSetDepth();
    calculateDiscoveryScheduleDepth();
}

function calculateRangeSetDepth(){ 
    var rangeSetGr = new GlideRecord('discovery_range');
    rangeSetGr.addEncodedQuery('active=true');
    rangeSetGr.query();
    while(rangeSetGr.next()){
        var rangeSetDepth = 0;
        var rangeItemGr = new GlideRecord('discovery_range_item');
        rangeItemGr.addEncodedQuery('parent='+rangeSetGr.getUniqueValue()+'^active=true');
        rangeItemGr.query();
        while(rangeItemGr.next()){
            rangeSetDepth += parseInt(rangeItemGr.getValue('u_number_of_ips'));
        }
        rangeSetGr.setValue('u_number_of_ips',rangeSetDepth);
        rangeSetGr.setWorkflow(false);
        rangeSetGr.update();
    }
}

function calculateDiscoveryScheduleDepth(){
    var discoveryScheduleGr = new GlideRecord('discovery_schedule');
    discoveryScheduleGr.addEncodedQuery('active=true^discover=CIs');
    discoveryScheduleGr.query();
    while(discoveryScheduleGr.next()){
        var discoveryScheduleDepth = 0;
        var rangeSetGr = new GlideRecord('discovery_schedule_range');
        rangeSetGr.addEncodedQuery('dscheduler='+discoveryScheduleGr.getUniqueValue());
        rangeSetGr.query();
        while(rangeSetGr.next()){
            var rangeRecord = rangeSetGr.range.getRefRecord();
            if(rangeRecord.getValue('active')){
                discoveryScheduleDepth += parseInt(rangeRecord.getValue('u_number_of_ips'));
            }
        }
        gs.print(discoveryScheduleGr.getValue('name')+' covers '+discoveryScheduleDepth+' ips.');
        discoveryScheduleGr.setValue('u_number_of_ips',discoveryScheduleDepth);
        discoveryScheduleGr.setWorkflow(false);
        discoveryScheduleGr.update();
    }
}

function calculateIPDepth(type,obj){
    if(type == 'IP Network'){
        var nw = new SncIPNetworkV4(obj.network_ip+'/'+obj.netmask);
        return parseInt(nw.size());
    }
    else if(type == 'IP Address Range'){
        return parseInt(new SncIPAddressV4(obj.endAddr).getAddressAsLong() - new SncIPAddressV4(obj.startAddr).getAddressAsLong());
    }
    else if(type == 'IP Address List'){
        var aggrGr = new GlideAggregate(obj.table);
        aggrGr.addEncodedQuery(obj.query);
        aggrGr.addAggregate('COUNT');
        aggrGr.query();
        if(aggrGr.next()){
            return aggrGr.getAggregate('COUNT');
        }
        else{
            return 0;
        }
    }
}

runThis();