var discoveryAutomationUtils = Class.create();
discoveryAutomationUtils.prototype = {

    // createDiscoverySchedules - Every day once
    // refreshDiscoveryIPDepth - Every day after createDiscoverySchedules
    // calculateECCAgentClusterCoverage - Every day once
    // checkThresholdBreachAndNotify - Every day once
    // realignSchedules - Every day once
    // calculateIPNetworkBuckets - Every Week Once

    initialize: function() {

    },

    createDiscoverySchedules: function() {
        if (this.isSystemEnabled()) {
            this.disableExistingOnDemandItems();
            var ibNetworkParent = new GlideRecord("x_snc_ib_ipam_network");
            ibNetworkParent.addEncodedQuery(this.getParams("ITOM Automation", "parentNetworkQuery"));
            ibNetworkParent.query();
            while (ibNetworkParent.next()) {
                this.createScheduleFromParent(ibNetworkParent);
            }
            this.runOnDemandDiscovery();
        } else {
            this.logMessage('MID Re-Architecture', '"createDiscoverySchedules" function will not be triggered, system not enabled!');
        }
    },

    createScheduleFromParent: function(ibNetworkParent) {
        var ds = new GlideRecord("discovery_schedule");
        ds.addQuery("name", "Mgmt Range - " + ibNetworkParent.network);
        ds.query();
        if (ds.next()) {
            // Parent Schedule /16 for this record already exists. Update the range sets for this schedule.
            // gs.error("Discovery Automation error for "+ibNetworkParent.network+" Discovery Schedule already exists");
            this.createRangeSets(ibNetworkParent, ds);
        } else {
            var fieldValues = JSON.parse(this.getParams("ITOM Automation", "discoveryScheduleFields"));
            var dsNew = new GlideRecord("discovery_schedule");
            dsNew.initialize();
            dsNew.name = "Mgmt Range - " + ibNetworkParent.network;
            dsNew.location = this.getLocationFromNetwork(ibNetworkParent);
            dsNew.u_is_auto_discovered = true;
            for (var f in fieldValues) {
                dsNew.setValue(f, fieldValues[f]);
            }
            dsNew.insert();
            this.createRangeSets(ibNetworkParent, dsNew);
        }
    },

    createRangeSets: function(ibNetwork, ds) {
        var ibNetworkChild = new GlideRecord("x_snc_ib_ipam_network");
        ibNetworkChild.addQuery("parent", ibNetwork.getUniqueValue());
        ibNetworkChild.query();
        while (ibNetworkChild.next()) {
            var dsr = new GlideRecord("discovery_schedule_range");
            dsr.addQuery("dscheduler", ds.getUniqueValue());
            dsr.addQuery("range.name", ibNetworkChild.network);
            dsr.query();
            if (dsr.next()) {
                // Already exists. Update?
                this.createRangeItems(ibNetworkChild, dsr.range.getRefRecord(), ds);
            } else {
                var drNew = new GlideRecord("discovery_range");
                drNew.initialize();
                drNew.u_is_auto_discovered = true;
                drNew.name = ibNetworkChild.getValue("network");
                drNew.active = true;
                drNew.setWorkflow(false);
                drNew.insert();
                var dsrNew = new GlideRecord("discovery_schedule_range");
                dsrNew.initialize();
                dsrNew.range = drNew.getUniqueValue();
                dsrNew.active = true;
                dsrNew.dscheduler = ds.getUniqueValue();
                dsrNew.setWorkflow(false);
                dsrNew.insert();
                this.createRangeItems(ibNetworkChild, drNew, ds);
            }
        }
    },

    createRangeItems: function(ibNetwork, dr, ds) {
        if (ibNetwork.network_container) {
            var ibNetworkChild = new GlideRecord("x_snc_ib_ipam_network");
            ibNetworkChild.addQuery("parent", ibNetwork.getUniqueValue());
            ibNetworkChild.query();
            while (ibNetworkChild.next()) {
                this.createRangeItems(ibNetworkChild, dr, ds);
            }
        } else {
            // Check if Range Item already exists. Update?
            var network = ibNetwork.network.split("/");
            var dri = new GlideRecord("discovery_range_item");
            dri.addQuery("parent", dr.getUniqueValue());
            dri.addQuery("name", ibNetwork.network);
            dri.query();
            if (dri.next()) {
                // Discovery Range Item exists. Make active?
            } else {
                this.createAdHocRanges(network[0], network[1]);
                var driNew = new GlideRecord("discovery_range_item");
                driNew.initialize();
                driNew.u_is_auto_discovered = true;
                driNew.name = ibNetwork.network;
                driNew.summary = ibNetwork.network;
                driNew.type = "IP Network";
                driNew.active = true;
                driNew.parent = dr.getUniqueValue();
                driNew.network_ip = network[0];
                driNew.netmask = network[1];
                driNew.setWorkflow(false);
                driNew.insert();
                this.makeParentsActive(dr, ds);
            }
        }
    },

    makeParentsActive: function(dr, ds) {
        dr.active = true;
        ds.active = true;
        dr.update();
        ds.update();
    },

    refreshDiscoveryIPDepth: function() {
        this.calculateRangeItemDepth();
        this.calculateRangeSetDepth();
        this.calculateDiscoveryScheduleDepth();
        this.firstImportConfiguration();
        this.subsequentImportConfiguration();
    },

    calculateIPNetworkBuckets: function() {
        this.wipeIPNetworkProcessQueue();
        this.calculateDiscoveryScheduleBucketIPNetwork();
        this.calculateRangeSetBucketIPNetwork();
        this.calculateRangeItemBucketIPNetwork();
        this.triggerNetworkProcessing();
    },

    runOnDemandDiscovery: function() {
        if (!this.isFirstImport()) {
            var dScheduleGr = new GlideRecord('discovery_schedule');
            dScheduleGr.get(this.getParams('ITOM Automation', 'adHocScheduleId'));
            this.triggerDiscovery(dScheduleGr);
        }
    },

    disableSystem: function() {
        var schedules = [];
        var ds = new GlideRecord("discovery_schedule");
        ds.addEncodedQuery('nameSTARTSWITHMgmt Range - ');
        ds.query();
        while (ds.next()) {
            schedules.push(ds.getValue('name'));
            ds.setValue('run_after', '');
            ds.setValue('active', false);
            ds.setWorkflow(false);
            ds.update();
        }

        var autoTypeGr = new GlideRecord('u_itsrt_automation_type');
        autoTypeGr.addEncodedQuery('u_automation_name.u_name=ITOM Automation^u_name=systemEnabled');
        autoTypeGr.query();
        if (autoTypeGr.next()) {
            autoTypeGr.setValue('u_probe_script', 'false');
            autoTypeGr.update();
        }

        this.logMessage('MID Re-Architecture', 'Schedules disabled: ' + schedules.toString());
        this.logMessage('MID Re-Architecture', '"systemEnabled" flag under the "ITOM Automation" within ITSRT Command Centre has been set to "false"!');
    },

    disableExistingOnDemandItems: function() {
        var riGr = new GlideRecord('discovery_range_item');
        riGr.addEncodedQuery('schedule=' + this.getParams('ITOM Automation', 'adHocScheduleId') + '^active=true');
        riGr.query();
        while (riGr.next()) {
            riGr.setValue('active', false);
            riGr.setWorkflow(false);
            riGr.update();
        }
    },

    createAdHocRanges: function(network_ip, netmask) {
        var adhocScheduleId = this.getParams('ITOM Automation', 'adHocScheduleId');
        var fullName = network_ip.toString() + '/' + netmask.toString();
        var riGr = new GlideRecord('discovery_range_item');
        riGr.initialize();
        riGr.setValue('type', 'IP Network');
        riGr.setValue('active', true);
        riGr.setValue('name', fullName);
        riGr.setValue('summary', fullName);
        riGr.setValue('network_ip', network_ip);
        riGr.setValue('netmask', netmask);
        riGr.setValue('schedule', adhocScheduleId);
        riGr.insert();
    },

    subsequentImportConfiguration: function() {
        if (!this.isFirstImport()) {
            var dScheduleGr = new GlideRecord('discovery_schedule');
            dScheduleGr.addEncodedQuery('nameSTARTSWITHMgmt Range^active=true^discover=CIs^mid_cluster=NULL^u_is_auto_discovered=true');
            dScheduleGr.query();
            while (dScheduleGr.next()) {
                dScheduleGr.setValue('mid_cluster', this.getNextAvailableCluster());
                this.updateECCAgentClusterScope(dScheduleGr);
                dScheduleGr.update();
            }
        }
    },

    getParams: function(automationName, automationType) {
        var utilityFunction = new global.ITSRTAutomationUtil();
        return utilityFunction.getProbeScript(automationName, automationType);
    },

    getLocationFromNetwork: function(ibNetwork) {
        var cidc = new GlideRecord("cmdb_ci_datacenter");
        cidc.get(ibNetwork.getValue("site"));
        return cidc.location;
    },

    isFirstImport: function() {
        var autoTypeGr = new GlideRecord('u_itsrt_automation_type');
        autoTypeGr.addEncodedQuery('u_automation_name.u_name=ITOM Automation^u_name=isFirstImport^u_probe_script=true');
        autoTypeGr.query();
        if (autoTypeGr.next()) {
            return true;
        }
        return false;
    },

    firstImportConfiguration: function() {
        if (this.isFirstImport()) {
            this.assignECCAgentCluster();
            this.disableFirstImportFlag();
            this.calculateIPNetworkBuckets();
        }
        return;
    },

    disableFirstImportFlag: function() {
        var autoTypeGr = new GlideRecord('u_itsrt_automation_type');
        autoTypeGr.addEncodedQuery('u_automation_name.u_name=ITOM Automation^u_name=isFirstImport^u_probe_script=true');
        autoTypeGr.query();
        if (autoTypeGr.next()) {
            autoTypeGr.setValue('u_probe_script', 'false');
            autoTypeGr.update();
        }
        return;
    },

    calculateDiscoveryScheduleBucketIPNetwork: function() {
        var dScheduleGr = new GlideRecord('discovery_schedule');
        dScheduleGr.addEncodedQuery('u_is_auto_discovered=true^active=true^nameSTARTSWITHMgmt Range^discover=CIs^u_start_ip_address_decimalISEMPTY^ORu_end_ip_address_decimalISEMPTY');
        dScheduleGr.query();
        while (dScheduleGr.next()) {
            var temp = dScheduleGr.getValue('name').toString().replace('Mgmt Range - ', '').split('/');
            this.createIPNetworkProcessQueueRecord(temp[0], temp[1], dScheduleGr.getUniqueValue(), 'dschedule');
        }
        return;
    },

    getRangeSets: function() {
        var rangeSetItems = [];
        var dScheduleRangeGr = new GlideRecord('discovery_schedule_range');
        dScheduleRangeGr.addEncodedQuery('range.u_start_ip_address_decimalISEMPTY^ORrange.u_end_ip_address_decimalISEMPTY^dscheduler.nameSTARTSWITHMgmt Range^dscheduler.active=true^range.u_is_auto_discovered=true');
        dScheduleRangeGr.query();
        while (dScheduleRangeGr.next()) {
            rangeSetItems.push(dScheduleRangeGr.getValue('range'));
        }

        if (rangeSetItems.length > 1) {
            return rangeSetItems;
        } else {
            this.logMessage('MID Re-Architecture', 'getRangeSets() cannot find any range sets!');
            return;
        }
    },

    calculateRangeSetBucketIPNetwork: function() {
        var rangeSetItems = this.getRangeSets();
        for (var i = 0; i < rangeSetItems.length; i++) {
            var rangeSetGr = new GlideRecord('discovery_range');
            rangeSetGr.get(rangeSetItems[i]);
            if (rangeSetGr.getValue('active') == true) {
                var temp = rangeSetGr.getValue('name').toString().split('/');
                this.createIPNetworkProcessQueueRecord(temp[0], temp[1], rangeSetItems[i], 'range_set');
            }
        }
    },

    calculateRangeItemBucketIPNetwork: function() {
        var rangeItem = new GlideRecord('discovery_range_item');
        rangeItem.addEncodedQuery('active=true^u_is_auto_discovered=true^type=IP Network^u_start_ip_address_decimalISEMPTY^ORu_end_ip_address_decimalISEMPTY');
        rangeItem.query();
        while (rangeItem.next()) {
            this.createIPNetworkProcessQueueRecord(rangeItem.getValue('network_ip'), rangeItem.getValue('netmask'), rangeItem.getUniqueValue(), 'range_item');
        }
    },

    createIPNetworkProcessQueueRecord: function(network_ip, netmask, id, recType) {
        var processorGr = new GlideRecord('u_ip_network_processing_queue');
        processorGr.initialize();
        processorGr.setValue('u_document_id', id);
        processorGr.setValue('u_network_ip', network_ip);
        processorGr.setValue('u_netmask', netmask);
        processorGr.setValue('u_document_type', recType);
        processorGr.setValue('u_status', 'ready');
        processorGr.insert();
    },

    getStartEndIPNetwork: function(ip, netmask, id, type, queueID) {

        if (JSUtil.nil(ip) || JSUtil.nil(netmask) || JSUtil.nil(id) || JSUtil.nil(type)) {
            this.logMessage('MID Re-Architecture', 'missing parameters!\nnetwork_ip : ' + ip + ' netmask : ' + netmask + ' id : ' + id + ' type: ' + type + ')');
            return;
        }

        var eccAgent = this.getRandomDiscoMID() || this.getParams("ITOM Automation", "nwDecodeEccAgent"); //backup MID to support the decoding!

        if (JSUtil.nil(eccAgent)) {
            this.logMessage('MID Re-Architecture', 'missing "eccAgent"! cannot start the function getStartEndIPNetwork()');
            return;
        }

        var jspr = new JavascriptProbe(eccAgent);
        jspr.setName('getLastNetworkIP');
        jspr.setJavascript(this.getParams("ITOM Automation", "nwDecodeScript"));
        jspr.addParameter("record_type", type);

        if (type == 'range_item') {
            jspr.addParameter("range_item_id", id);
        } else if (type == 'range_set') {
            jspr.addParameter("range_set_id", id);
        } else if (type == 'dschedule') {
            jspr.addParameter("dschedule_id", id);
        } else {
            this.logMessage('MID Re-Architecture', 'Unindentified type paramater passed, exiting function getStartEndIPNetwork()');
        }

        jspr.addParameter("ip_network", ip + "/" + netmask);
        jspr.addParameter("probe", this.getParams("ITOM Automation", "nwDecodeProbe"));
        jspr.addParameter("queue_id", queueID);
        jspr.create();
    },

    getRandomDiscoMID: function() {
        var mids = this.getDiscoMIDS();
        if (mids) {
            return mids[Math.floor(Math.random() * mids.length)];
        }
    },

    getDiscoMIDS: function() {
        var mids = [];
        var eccGr = new GlideRecord('ecc_agent');
        eccGr.addEncodedQuery('nameSTARTSWITHMID_Discovery_Azure^status=up');
        eccGr.query();
        while (eccGr.next()) {
            mids.push(eccGr.getValue('name'));
        }

        if (JSUtil.notNil(mids)) {
            return mids;
        }
        this.logMessage('MID Re-Architecture', 'MIDs not found to create IP Network process queues!');
    },

    calculateRangeItemDepth: function() {
        var rangeItem = new GlideRecord('discovery_range_item');
        rangeItem.addEncodedQuery('parent.name!=NULL^active=true^u_is_auto_discovered=true');
        rangeItem.query();
        while (rangeItem.next()) {
            var totalIP = 0;
            var excludeIP = 0;
            var exclusionSet = 0;
            var type = rangeItem.getValue('type');
            var id = rangeItem.getUniqueValue();
            var obj = {};
            var exclusionDepthObj = {};

            if (type == 'IP Network') {
                obj.network_ip = rangeItem.getValue('network_ip');
                obj.netmask = rangeItem.getValue('netmask');
                totalIP = this.calculateIPDepth(type, obj);
            } else if (type == 'IP Address List') {
                obj.table = 'discovery_range_item_ip';
                obj.query = 'item_parent=' + id.toString();
                totalIP = this.calculateIPDepth(type, obj);
            } else if (type == 'IP Address Range') {
                obj.startAddr = rangeItem.getValue('start_ip_address');
                obj.endAddr = rangeItem.getValue('end_ip_address');
                totalIP = this.calculateIPDepth(type, obj);
            } else {
                this.logMessage('MID Re-Architecture', 'Unidentified range item (discovery_range_item) record found, ID is :: ' + id);
            }

            var exclusionObj = new GlideAggregate('discovery_range_item_exclude');
            exclusionObj.addEncodedQuery('parent=' + id.toString());
            exclusionObj.addAggregate('COUNT');
            exclusionObj.query();
            if (exclusionObj.next()) {
                exclusionSet = exclusionObj.getAggregate('COUNT');
            }
            //this.logMessage('MID Re-Architecture', 'exclusionSet count is '+exclusionSet);

            if (exclusionSet > 0) {
                var exclusionList = new GlideRecord('discovery_range_item_exclude');
                exclusionList.addEncodedQuery('parent=' + id.toString());
                exclusionList.query();
                while (exclusionList.next()) {
                    var exclusionType = exclusionList.getValue('type');
                    this.logMessage('MID Re-Architecture', 'Exclusion type is ' + exclusionType);
                    if (exclusionType == 'IP Network') {
                        exclusionDepthObj.network_ip = exclusionList.getValue('network_ip');
                        exclusionDepthObj.netmask = exclusionList.getValue('netmask');
                        excludeIP += this.calculateIPDepth(exclusionType, exclusionDepthObj);
                    } else if (exclusionType == 'IP Address List') {
                        exclusionDepthObj.table = 'discovery_range_item_ip';
                        exclusionDepthObj.query = 'exclude_parent=' + exclusionList.getUniqueValue().toString();
                        excludeIP += this.calculateIPDepth(exclusionType, exclusionDepthObj);
                    } else if (exclusionType == 'IP Address Range') {
                        exclusionDepthObj.startAddr = exclusionList.getValue('start_ip_address');
                        exclusionDepthObj.endAddr = exclusionList.getValue('end_ip_address');
                        excludeIP += this.calculateIPDepth(exclusionType, exclusionDepthObj);
                    }
                }
                totalIP = totalIP - excludeIP;
            }

            rangeItem.setValue('u_number_of_ips', totalIP);
            rangeItem.setWorkflow(false);
            rangeItem.update();
        }
    },

    calculateIPDepth: function(type, obj) {
        //this.logMessage('MID Re-Architecture','JSON Object passed is\n'+JSON.stringify(obj));
        if (type == 'IP Network') {
            var nw = new SncIPNetworkV4(obj.network_ip + '/' + obj.netmask);
            return parseInt(nw.size());
        } else if (type == 'IP Address Range') {
            return parseInt((new SncIPAddressV4(obj.endAddr).getAddressAsLong()) - (new SncIPAddressV4(obj.startAddr).getAddressAsLong()));
        } else if (type == 'IP Address List') {
            var aggrGr = new GlideAggregate(obj.table);
            aggrGr.addEncodedQuery(obj.query);
            aggrGr.addAggregate('COUNT');
            aggrGr.query();
            if (aggrGr.next()) {
                return aggrGr.getAggregate('COUNT');
            } else {
                return 0;
            }
        }
    },

    calculateRangeSetDepth: function() {
        var rangeSetItems = this.getRangeSets();
        if (Array.isArray(rangeSetItems)) {
            for (var i = 0; i < rangeSetItems.length; i++) {
                var rangeSetGr = new GlideRecord('discovery_range');
                rangeSetGr.addEncodedQuery('active=true^u_is_auto_discovered=true^sys_id=' + rangeSetItems[i]);
                rangeSetGr.query();
                if (rangeSetGr.next()) {
                    var rangeSetDepth = 0;
                    var rangeItemGr = new GlideRecord('discovery_range_item');
                    rangeItemGr.addEncodedQuery('parent=' + rangeSetItems[i] + '^active=true^u_is_auto_discovered=true');
                    rangeItemGr.query();
                    while (rangeItemGr.next()) {
                        rangeSetDepth += parseInt(rangeItemGr.getValue('u_number_of_ips'));
                    }
                    rangeSetGr.setValue('u_number_of_ips', rangeSetDepth);
                    rangeSetGr.setWorkflow(false);
                    rangeSetGr.update();
                }
            }
        }
        return;
    },

    calculateDiscoveryScheduleDepth: function() {
        var discoveryScheduleGr = new GlideRecord('discovery_schedule');
        discoveryScheduleGr.addEncodedQuery('nameSTARTSWITHMgmt Range^active=true^u_is_auto_discovered=true^discover=CIs');
        discoveryScheduleGr.query();
        while (discoveryScheduleGr.next()) {
            var discoveryScheduleDepth = 0;
            var rangeSetGr = new GlideRecord('discovery_schedule_range');
            rangeSetGr.addEncodedQuery('dscheduler=' + discoveryScheduleGr.getUniqueValue());
            rangeSetGr.query();
            while (rangeSetGr.next()) {
                var rangeRecord = rangeSetGr.range.getRefRecord();
                if (rangeRecord.getValue('active')) {
                    discoveryScheduleDepth += parseInt(rangeRecord.getValue('u_number_of_ips'));
                }
            }
            discoveryScheduleGr.setValue('u_number_of_ips', discoveryScheduleDepth);
            discoveryScheduleGr.setWorkflow(false);
            discoveryScheduleGr.update();
        }
        return;
    },

    calculateECCAgentClusterCoverage: function() {
        var obj = {};
        var dScheduleGr = new GlideRecord('discovery_schedule');
        dScheduleGr.addEncodedQuery('nameSTARTSWITHMgmt Range^active=true^discover=CIs^mid_cluster!=NULL^u_is_auto_discovered=true');
        dScheduleGr.orderBy('mid_cluster');
        dScheduleGr.query();
        while (dScheduleGr.next()) {
            if (typeof obj[dScheduleGr.getValue('mid_cluster')] === 'undefined') {
                obj[dScheduleGr.getValue('mid_cluster')] = 0;
            }
            var temp = parseInt(obj[dScheduleGr.getValue('mid_cluster')]);
            temp = temp + parseInt(dScheduleGr.getValue('u_number_of_ips'));
            obj[dScheduleGr.getValue('mid_cluster')] = temp;
        }
        this.updateECCAgentClusterCoverage(obj);
        return;
    },

    updateECCAgentClusterCoverage: function(obj) {
        if (typeof obj == 'object') {
            for (i in obj) {
                var eccClusterGr = new GlideRecord('ecc_agent_cluster');
                eccClusterGr.get(i);
                eccClusterGr.setValue('u_ip_coverage', obj[i]);
                eccClusterGr.update();
            }
        } else {
            this.logMessage('MID Re-Architecture', 'Unable to update the ECC Agent Cluster Coverage');
        }
        return;
    },

    logMessage: function(app, msg) {
        gs.error('ITOM :: ' + app + ' :: ' + msg);
        return;
    },

    isSystemEnabled: function() {
        if ((this.getParams('ITOM Automation', 'systemEnabled') === true) || (this.getParams('ITOM Automation', 'systemEnabled') === 'true')) {
            return true;
        }
        return false;
    },

    resetSystemVariables: function() {
        var resetObjs = JSON.parse(this.getParams('ITOM Automation', 'resetParameters'));
        for (var keys in resetObjs) {
            var recGr = new GlideRecord(keys);
            recGr.addEncodedQuery(resetObjs[keys].toString());
            recGr.query();
            while (recGr.next()) {
                if (keys === 'ecc_agent_cluster') {
                    recGr.setValue('u_ip_coverage', 0);
                } else {
                    recGr.setValue('u_number_of_ips', 0);
                }
                recGr.setWorkflow(false);
                recGr.update();
            }
        }
        this.resetFirstImportFlag();
    },

    resetFirstImportFlag: function() {
        var autoTypeGr = new GlideRecord('u_itsrt_automation_type');
        autoTypeGr.addEncodedQuery('u_automation_name.u_name=ITOM Automation^u_name=isFirstImport');
        autoTypeGr.query();
        if (autoTypeGr.next()) {
            autoTypeGr.setValue('u_probe_script', 'true');
            autoTypeGr.update();
        }
    },

    wipeIPNetworkProcessQueue: function() {
        this.logMessage('MID Re-Architecture', 'IP Network Processing Queue Deletion :: started!');
        var pqGr = new GlideRecord('u_ip_network_processing_queue');
        pqGr.query();
        pqGr.deleteMultiple();
        this.logMessage('MID Re-Architecture', 'IP Network Processing Queue Deletion :: completed!');
    },

    getECCAgentClusters: function() {
        var eccClusterGr = new GlideRecord('ecc_agent_cluster');
        eccClusterGr.addEncodedQuery('nameSTARTSWITHMIDCluster_Discovery');
        eccClusterGr.query();
        var eccClusterSet = [];
        while (eccClusterGr.next()) {
            eccClusterSet.push(eccClusterGr.getUniqueValue());
        }
        return eccClusterSet;
    },

    assignECCAgentCluster: function() {
        var clusters = this.getECCAgentClusters();
        var lbObj = [];

        for (var i = 0; i < clusters.length; i++) {
            var obj = {};
            obj.id = clusters[i];
            obj.weight = 0;
            lbObj.push(obj);
        }

        var dScheduleGr = new GlideRecord('discovery_schedule');
        dScheduleGr.addEncodedQuery('nameSTARTSWITHMgmt Range^active=true^discover=CIs^mid_cluster=NULL^u_is_auto_discovered=true');
        dScheduleGr.query();
        while (dScheduleGr.next()) {
            lbObj = this.getClusterWithMinimalLoad(lbObj, dScheduleGr.getValue('u_number_of_ips'));
            this.logMessage('MID Re-Architecture', 'lbObj :: \n' + JSON.stringify(lbObj, null, 2));
            dScheduleGr.setValue('mid_cluster', lbObj[0].id);
            dScheduleGr.update();
        }
        this.updateEccClusterScopeFirstTime(lbObj);
    },

    getClusterWithMinimalLoad: function(lbObj, weightage) {
        lbObj.sort(function(a, b) {
            if (a.weight < b.weight) {
                return -1;
            } else {
                return 1;
            }
        });
        lbObj[0].weight += parseInt(weightage);
        return lbObj;
    },

    getNextAvailableCluster: function() {
        var eccClusterGr = new GlideRecord('ecc_agent_cluster');
        eccClusterGr.addEncodedQuery('nameSTARTSWITHMIDCluster_Discovery');
        eccClusterGr.orderBy('u_ip_coverage');
        eccClusterGr.query();
        if (eccClusterGr.next()) {
            return eccClusterGr.getUniqueValue();
        }
        return;
    },

    triggerNetworkProcessing: function() {
        var autoGr = new GlideRecord('sysauto_script');
        autoGr.get(this.getParams('ITOM Automation', 'decodeJobID'));
        SncTriggerSynchronizer.executeNow(autoGr);
    },

    updateEccClusterScopeFirstTime: function(obj) {
        if (Array.isArray(obj)) {
            for (var i = 0; i < obj.length; i++) {
                var eccClusterGr = new GlideRecord('ecc_agent_cluster');
                eccClusterGr.get(obj[i].id);
                eccClusterGr.setValue('u_ip_coverage', obj[i].weight);
                eccClusterGr.update();
            }
        }
        return;
    },

    updateECCAgentClusterScope: function(obj) {
        var eccClusterGr = new GlideRecord('ecc_agent_cluster');
        eccClusterGr.get(obj.getValue('mid_cluster'));
        eccClusterGr.setValue('u_ip_coverage', parseInt(obj.getValue('u_number_of_ips')) + parseInt(eccClusterGr.getValue('u_ip_coverage')));
        eccClusterGr.update();
    },

    checkThresholdBreachAndNotify: function() {
        var maxLimit = parseInt(this.getParams('ITOM Automation', 'maxClusterCoverage'));
        var threshold = parseInt(this.getParams('ITOM Automation', 'clusterCoverageThreshold'));
        var thresholdLimit = Math.round((threshold / 100) * maxLimit);
        var eccAgentCluster = new GlideRecord('ecc_agent_cluster');
        eccAgentCluster.addEncodedQuery('u_ip_coverage>=' + thresholdLimit);
        eccAgentCluster.query();
        while (eccAgentCluster.next()) {
            gs.eventQueue('mid.cluster.threshold.breach.loadLimit', eccAgentCluster, eccAgentCluster.getValue('name'), threshold);
        }
    },

    checkIfAnyActiveSchedulesWithoutClusters: function() {
        var count = 0;
        var dScheduleGa = new GlideAggregate('discovery_schedule');
        dScheduleGa.addEncodedQuery('nameSTARTSWITHMgmt Range^active=true^discover=CIs^mid_cluster=NULL^u_is_auto_discovered=true');
        dScheduleGa.addAggregate('COUNT');
        dScheduleGa.query();
        count = dScheduleGa.getAggregate('COUNT');

        if (count > 0) {
            return false;
        }
        return true;
    },

    realignSchedules: function() {
        var maxRunTimeThreshold = parseInt(this.getParams('ITOM Automation', 'maxRunTimeThreshold'));
        var followUpDiscoverySchedule = this.getParams('ITOM Automation', 'isFollowUpDiscoveryEnabled');
        this.logMessage('MID Re-Architecture', 'Schedule re-alignment initiated!');
        if (this.checkIfAnyActiveSchedulesWithoutClusters()) {
            var hrLimit = 168; //translates to (24 * 7) hrs in a week
            var clusterSet = this.getECCAgentClusters();
            for (var i = 0; i < clusterSet.length; i++) {
                var maxRunTimeObj = {};
                maxRunTimeObj.thresholdHit = false;
                maxRunTimeObj.eccCluster_id = '';
                maxRunTimeObj.eccCluster_name = '';
                maxRunTimeObj.object = '';
                if (followUpDiscoverySchedule === 'true') {
                    var tempSet = [];
                    var firstRec = '';
                    var lastRec = '';
                    var count = 0;
                }
                var instance = 0;
                var dScheduleGr = new GlideRecord('discovery_schedule');
                dScheduleGr.addEncodedQuery('nameSTARTSWITHMgmt Range^active=true^discover=CIs^mid_cluster!=NULL^u_is_auto_discovered=true^mid_cluster=' + clusterSet[i]);
                dScheduleGr.orderByDesc('u_number_of_ips');
                dScheduleGr.query();
                instance = dScheduleGr.getRowCount();
                var maxRunTimePerInstance = Math.round(hrLimit / instance);
                this.logMessage('MID Re-Architecture', JSON.stringify(maxRunTimeObj));
                while (dScheduleGr.next()) {
                    var runTime = new GlideDateTime('1970-01-01 00:00:00');
                    runTime.addSeconds(maxRunTimePerInstance * 60 * 60);
                    /****
					STRY2066662: This is not needed as we are operating the MIDs 24 * 7 * 365
					runTime.addSeconds(-1800); //30 mins intentional down time!
					****/
                    dScheduleGr.setValue('max_run', runTime.toString());
                    if (followUpDiscoverySchedule === 'true') {
                        if (count > 0) {
                            if (!dScheduleGr.hasNext()) {
                                lastRec = dScheduleGr.getUniqueValue();
                            }
                            var parent = tempSet.pop();
                            dScheduleGr.setValue('run_after', parent);
                            tempSet.push(dScheduleGr.getUniqueValue());
                        } else {
                            firstRec = dScheduleGr.getUniqueValue();
                            tempSet.push(dScheduleGr.getUniqueValue());
                        }
                        count++;
                    }
                    dScheduleGr.setWorkflow(false);
                    dScheduleGr.update();

                    if (!(maxRunTimeObj.thresholdHit)) {
                        if (maxRunTimePerInstance <= maxRunTimeThreshold) {
                            maxRunTimeObj.thresholdHit = true;
                            maxRunTimeObj.eccCluster_id = clusterSet[i];
                            maxRunTimeObj.eccCluster_name = dScheduleGr.getDisplayValue('mid_cluster');
                            maxRunTimeObj.object = dScheduleGr;
                        }
                    }
                }
                if (maxRunTimeObj.thresholdHit) {
                    gs.eventQueue('mid.cluster.threshold.breach.maxRunTime', maxRunTimeObj.object, maxRunTimeObj.eccCluster_name, maxRunTimeThreshold);
                }
                if (followUpDiscoverySchedule === 'true') {
                    this.updateFollowUpSchedules(firstRec, lastRec);
                }
            }
        } else {
            this.logMessage('MID Re-Architecture', 'Records found in "discovery_schedule" table with allocation of MID clusters! Backup provision mechanism will be kicked off!');
            this.subsequentImportConfiguration(); //Will do automatic assignment of discovery_schedule.
            this.realignSchedules(); //Recursion mechanism to bi-furcate schedules
        }
    },

    updateFollowUpSchedules: function(child, parent) {
        var dScheduleGr = new GlideRecord('discovery_schedule');
        if (dScheduleGr.get(child)) {
            dScheduleGr.setValue('run_after', parent);
            dScheduleGr.setWorkflow(false);
            dScheduleGr.update();
        }
    },

    triggerDiscovery: function(dScheduleGr) {
        SncTriggerSynchronizer.executeNow(dScheduleGr);
    },

    setDynamicMaxRunTime: function() {
        var totalTime = (168 * 60 * 60); //in seconds
        var eccClusters = this.getECCAgentClusters();
        //gs.print(eccClusters);
        var obj = {};
        var eccClusterGr = '';
        for (var i = 0; i < eccClusters.length; i++) {
            eccClusterGr = new GlideRecord('ecc_agent_cluster');
            eccClusterGr.get(eccClusters[i]);

            var timePerIP = (totalTime / parseInt(eccClusterGr.getValue('u_ip_coverage')));
            if (typeof obj[eccClusters[i]] == 'undefined') {
                obj[eccClusters[i]] = {};
            }

            obj[eccClusters[i]]['timePerIP'] = timePerIP;
        }
        //gs.print(JSON.stringify(obj,null,2));

        for (var keys in obj) {
            var scheduleGr = new GlideRecord('discovery_schedule');
            scheduleGr.addEncodedQuery('mid_cluster=' + keys);
            scheduleGr.query();
            while (scheduleGr.next()) {
                var tempTime = parseInt(scheduleGr.getValue('u_number_of_ips') * obj[keys]['timePerIP']);
                var runTime = new GlideDateTime('1970-01-01 00:00:00');
                runTime.addSeconds(tempTime);
                scheduleGr.setValue('max_run', runTime.toString());
                scheduleGr.setWorkflow(false);
                scheduleGr.update();
            }
        }
    },

    restartMIDServices: function() {
        var flag = this.getParams('ITOM Automation','isMIDServiceRestartEnabled');
        if(flag === 'true' || flag === true) {
            var midServers = this.getDiscoMIDS();
            midServers = midServers.sort();
            var batchLength = parseInt(this.getParams('ITOM Automation','restartMIDServiceBatchLength'));
            var batches = midServers.length / batchLength;

            for(var i = 0; i < batches; i++){
                if(i == 0){
                    var max = i + batchLength;
                    var min = max - batchLength;
                }
                else{
                    min = min + batchLength;
                    max = max + batchLength;
                }
                this.restartMIDs(midServers.slice(min,max));
            }
        }
    },
	
	restartMIDs: function(mid){
		var midMgmt = new MIDServerManage();
		if(Array.isArray(mid)){
			for(var i = 0; i < mid.length; i++){
				midMgmt.restartService(mid[i]);
			}
		}
		else{
			midMgmt.restartService(mid);
		}
    }, 
    type: 'discoveryAutomationUtils'
};