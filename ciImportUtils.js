//jshint maxerr:200
var ciImportUtils = Class.create();
ciImportUtils.prototype = Object.extendsObject(AbstractAjaxProcessor, {

    executeWAPImport: function() { //initiate wap import
        var request = new sn_ws.RESTMessageV2('ITOps API', 'Get WAPs');
        request.setRequestHeader(this.getRequestParams('ITOps CI Import', 'tokenName'), this.getRequestParams('ITOps CI Import', 'requestToken'));
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestBody(this.getRequestParams('ITOps WAPs API Import', 'requestBody'));
        request.setEndpoint(this.getRequestParams('ITOps CI Import', 'requestEndPoint'));
        //request.setMIDServer(this.getRequestParams('ITOps WAPs API Import', 'requestMIDServer'));
        request.setEccParameter('skip_sensor', true);
        var response = request.execute();
        var httpStatus = response.getStatusCode();
        var errorCode = response.getErrorCode();
        var errorMessage = response.getErrorMessage();
        var output = '';
        if (httpStatus == 200) {
            response = JSON.parse(response.getBody());
            var itopsErrorString = response.result.status;
            if (itopsErrorString == 'success') {
                output = response.result.output;
                if ((output.indexOf("'") > -1) && (output.length > 2) && (output.indexOf('API Call failed') == -1)) {
                    output = output.replace(/'/g, '"');
                    output = JSON.parse(output);
                    this.createWAPImportRecord(JSON.stringify(output), httpStatus, errorCode, errorMessage, itopsErrorString, true);
                } else if (output.indexOf("splunklib.binding.AuthenticationError") > -1) {
                    this.createWAPImportRecord(output, httpStatus, errorCode, output, 'failed');
                } else {
                    this.createWAPImportRecord(output, httpStatus, errorCode, "The request failed:\n no available data from (/splunk/runquery).", 'failed');
                }
            } else {
                this.createWAPImportRecord(response.result.output, httpStatus, errorCode, errorMessage, response.result.status);
            }
        } else {
            this.createWAPImportRecord(JSON.stringify(response), httpStatus, errorCode, errorMessage, 'failed');
        }
    },

    getRequestParams: function(automationName, automationType) { //get ITSRT parameters
        var utilityFunction = new ITSRTAutomationUtil();
        return utilityFunction.getProbeScript(automationName, automationType);
    },

    getCount: function(tableName, query) {
        var counterGa = new GlideAggregate(tableName);
        counterGa.addEncodedQuery(query);
        counterGa.addAggregate('COUNT');
        counterGa.query();
        if (counterGa.next()) {
            return counterGa.getAggregate("COUNT");
        } else {
            return 0;
        }
    },

    initiateProcessingWAPImports: function(obj) {
        var response = JSON.parse(obj.getValue("u_response"));
        for (var i = 0; i < response.length; i++) {
            this.processWAPObjs(response[i]);
        }
        obj.setValue("u_processing_required", false);
        obj.update();
    },

    processWAPObjs: function(obj) { //process individual wap objects returned for target
        var payload = {};
        payload.items = [];
        payload.relations = [];
        var idObj = {};
        var isSwitchReferencePresent = false;
        var switchName = '';
        idObj.className = this.getRequestParams('ITOps WAPs API Import', 'targetCIClass');
        idObj.lookup = [];
        idObj.values = {};
        idObj.values['used_for'] = 'Production';
        for (var keys in obj) {
            var isDisabled = true;
            var attr = this.convertToSNOWFormatWAP(keys);
            if (typeof idObj.values[attr] == 'undefined') {
                idObj.values[attr] = '';
            }
            /* 
            ********
            STRY1709508: IT-Network-SRT confirmed that they don't want the integration to update the "Operational Status of the CI"
            
            if((attr == 'name') && JSUtil.notNil(obj[keys])){
            	if(obj[keys].toString().indexOf('disable') == -1){
            		isDisabled = false;
            	}
            }
            ********
            */
            //mac_address formatting
            if ((attr == 'mac_address') && JSUtil.notNil(obj[keys])) {
                var mac = obj[keys].match(/(.{1,2})/g).join(":");
                idObj.lookup.push(this.populatePrimaryMACsWAP(mac));
                idObj.values[attr] = mac;
            }
            //ip_address case handling /*if IP Address is empty that means that device is 'Non-Operational'*/
            else if ((attr == 'ip_address') && (obj[keys] == "NULL")) {
                //if(isDisabled){ ****commented for STRY1709508
                //idObj.values['operational_status'] = '2'; ****commented for STRY1709508
                idObj.values[attr] = ''; //if incase not working, hard set ****commented for STRY1709508
                //} 
            }
            //process model_id
            else if ((attr == 'model_id') && JSUtil.notNil(obj[keys])) {
                idObj.values[attr] = this.fetchWAPModel(obj[keys]);
            }
            //process location information
            else if ((attr == 'location') && JSUtil.notNil(obj[keys])) {
                idObj.values[attr] = this.fetchLocation(obj[keys].toString());
            }
            //process manufacturer information
            else if (attr == 'manufacturer') {
                idObj.values[attr] = this.getRequestParams('ITOps WAPs API Import', 'wapManufacturer');
            }
            //process MAC Addresses 2.4GHz
            else if ((attr == 'band_24') && JSUtil.notNil(obj[keys])) {
                if (obj[keys].charAt(obj[keys].length - 1) == "0") {
                    for (var i = 0; i < 16; i++) {
                        idObj.lookup.push(this.populateSecondaryMACsWAP(obj[keys].toString(), "2.4GHz Band", i));
                    }
                }
            }
            //process MAC Addresses 5GHz
            else if ((attr == 'band_5') && JSUtil.notNil(obj[keys])) {
                if (obj[keys].charAt(obj[keys].length - 1) == "0") {
                    for (var j = 0; j < 16; j++) {
                        idObj.lookup.push(this.populateSecondaryMACsWAP(obj[keys].toString(), "5 GHz Band", j));
                    }
                }
            }
			//is Switch reference available in the payload?
            else if ((attr == 'switch_name') && JSUtil.notNil(obj[keys])) {
                isSwitchReferencePresent = true;
                switchName = obj[keys];
            }
            //If nothing matches
            else {
                idObj.values[attr] = obj[keys];
            }
        }

        if (idObj['values']['name'].toString().startsWith("WAP")) { //To pull the location of WAPs with new naming convention
            idObj.values['location'] = this.fetchLocation(idObj['values']['name'].toString().split('-')[3]);
        }

        if (!JSUtil.notNil(idObj.values.location)) { //STRY1623045 - Location override fix for WAPs ITOps API Import
            delete idObj['values']['location'];
        }

        payload.items.push(idObj);

        if(isSwitchReferencePresent && switchName){ //Add reference if only the switch reference is available.
			var secondaryObj = this.linkSwitchRecord(switchName);
			if(JSUtil.notNil(secondaryObj)){ //Add relation is reference object found.
				payload.items.push(secondaryObj);
				payload.relations.push({parent:0, child: 1, type:'IP Connection::IP Connection'});
			}
        }

        var ciAction = JSON.parse(sn_cmdb.IdentificationEngine.identifyCI(JSON.stringify(payload)));
        if (ciAction.items[0].operation.toString() == 'INSERT') { //if new CI, then prepopulate 'owned by', 'supported by' & 'support group' values
            payload.items[0].values['owned_by'] = '';
            payload.items[0].values['owned_by'] = this.getRequestParams('ITOps WAPs API Import', 'wapOwnedBy');
            payload.items[0].values['supported_by'] = '';
            payload.items[0].values['supported_by'] = this.getRequestParams('ITOps WAPs API Import', 'wapSupportedBy');
            payload.items[0].values['support_group'] = '';
            payload.items[0].values['support_group'] = this.getRequestParams('ITOps WAPs API Import', 'wapSupportGroup');
            idObj.values['operational_status'] = '1';
        }

		
        var jsonUntil = new JSON();
        payload = jsonUntil.encode(payload);
        sn_cmdb.IdentificationEngine.createOrUpdateCI('Splunk', payload);
    },

    convertToSNOWFormatWAP: function(attribute) { //sync fields as in 'cmdb_ci_wap_network' table
        var hashMap = {};
        hashMap['ap_serialnumber'] = 'serial_number';
        hashMap['ap_name'] = 'name';
        hashMap['ap_mac'] = 'mac_address';
        hashMap['ap_ipaddress'] = 'ip_address';
        hashMap['ap_model'] = 'model_id';
        hashMap['manufacturer'] = 'manufacturer';
        hashMap['Sitename'] = 'location';
        hashMap['band_24'] = 'band_24';
        hashMap['band_5'] = 'band_5';
        hashMap['ap_version'] = 'firmware_version';
        hashMap['site_id'] = 'u_site_id';
        hashMap['device_id'] = 'correlation_id';
		hashMap['switch_name'] = 'switch_name';
		hashMap['port_id'] = 'port_id';
        return hashMap[attribute];
    },

    populateSecondaryMACsWAP: function(startMACAddr, band, i) {
        var attr = parseInt(i, 10).toString(16);
        var obj = {};
        obj.className = "cmdb_ci_network_adapter";
        obj.values = {};
        obj.values.name = band;
        obj.values.mac_address = (startMACAddr.substr(0, startMACAddr.length - 1) + attr).match(/(.{1,2})/g).join(":");
        obj.values.install_status = 1;
        obj.values.netmask = "255.255.255.0";
        obj.values.mac_manufacturer = this.getRequestParams('ITOps WAPs API Import', 'wapManufacturer');
        return obj;
    },

    populatePrimaryMACsWAP: function(mac) {
        var obj = {};
        obj.className = "cmdb_ci_network_adapter";
        obj.values = {};
        obj.values.name = "Primary";
        obj.values.mac_address = mac;
        obj.values.install_status = 1;
        obj.values.netmask = "255.255.255.0";
        obj.values.mac_manufacturer = this.getRequestParams('ITOps WAPs API Import', 'wapManufacturer');
        return obj;
    },

    fetchWAPModel: function(modelName) { //get WAP model
        var modelGr = new GlideRecord('cmdb_hardware_product_model');
        modelGr.addEncodedQuery('name=' + modelName);
        modelGr.query();
        if (modelGr.hasNext()) {
            modelGr.next();
            return modelGr.getUniqueValue();
        } else {
            modelGr.initialize();
            modelGr.name = modelName;
            modelGr.manufacturer = this.getRequestParams('ITOps WAPs API Import', 'wapManufacturer');
            modelGr.insert();
            return modelGr.getUniqueValue();
        }
    },

    linkSwitchRecord: function(switchName){
        var switchSerial = '';
        var switchGr = new GlideRecord('cmdb_ci_ip_switch');
        switchGr.addEncodedQuery('name='+switchName+'^operational_status=1'); //Go for Operational CIs only.
        switchGr.orderBy('sys_created_on'); //Check for the earliest created record
        switchGr.query();
        if((switchGr.next()) && (JSUtil.notNil(switchGr.getValue('serial_number')))){
            switchSerial = switchGr.getValue('serial_number');
        }
        else{
            return; //if not found, return.
        }

        var obj = {};
        obj.className = 'cmdb_ci_ip_switch';
        obj.values = {};
        obj.values['name'] = switchName;
        obj.values['serial_number'] = switchSerial;
        return obj;
    },

    fetchLocation: function(locationCode) { //get location
        var locGr = new GlideRecord('cmdb_ci_datacenter');
        locGr.addEncodedQuery('name=' + locationCode);
        locGr.query();
        if (locGr.next()) {
            return locGr.getValue('location');
        } else {
            var otherLocations = JSON.parse(this.getRequestParams('ITOps CI Import', 'otherSiteCodes'));
            if (typeof otherLocations[locationCode] != 'undefined') {
                return otherLocations[locationCode];
            }
            return '';
        }
    },

    createWAPImportRecord: function(response, httpStatus, errorCode, errorMessage, itopsErrorString, processingRequired) { //create logger record
        var importGr = new GlideRecord('u_itops_cmdb_ci_import');
        importGr.initialize();
        importGr.setValue('u_http_status', httpStatus);
        importGr.setValue('u_error_code', errorCode);
        importGr.setValue('u_error_string', errorMessage);
        importGr.setValue('u_itops_error_string', itopsErrorString);
        importGr.setValue('u_response', response);
        importGr.setValue('u_cmdb_ci_class', this.getRequestParams('ITOps WAPs API Import', 'targetCIClass'));
        importGr.setValue('u_processing_required', processingRequired);
        importGr.insert();
        return importGr.getUniqueValue();
    },

    purgeWAPImports: function() { //delete wap imports aged more than 30 days
        var purgeGr = new GlideRecord('u_itops_cmdb_ci_import');
        purgeGr.addEncodedQuery('u_cmdb_ci_class=cmdb_ci_wap_network^sys_created_on<javascript:gs.beginningOfLast30Days()');
        purgeGr.query();
        purgeGr.deleteMultiple();
    },

    executeSolsticeImport: function() {
        var request = new sn_ws.RESTMessageV2('ITOps API', 'Get Solstice Devices');
        request.setRequestHeader(this.getRequestParams('ITOps CI Import', 'tokenName'), this.getRequestParams('ITOps CI Import', 'requestToken'));
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestBody(this.getRequestParams('ITOps Solstice API Import', 'requestBody'));
        request.setEndpoint(this.getRequestParams('ITOps CI Import', 'requestEndPoint'));
        //request.setMIDServer(this.getRequestParams('ITOps Solstice API Import', 'requestMIDServer'));
        request.setEccParameter('skip_sensor', true);
        var response = request.execute();
        var httpStatus = response.getStatusCode();
        var errorCode = response.getErrorCode();
        var errorMessage = response.getErrorMessage();
        var output = '';
        if (httpStatus == 200) {
            response = JSON.parse(response.getBody());
            var itopsErrorString = response.result.status;
            if (itopsErrorString == 'success') {
                output = response.result.output;
                if ((output.indexOf("'") > -1) && (output.length > 2) && (output.indexOf('API Call failed') == -1)) {
                    output = output.replace(/'/g, '"');
                    output = JSON.parse(output);
                    for (var i = 0; i < output.length; i++) {
                        this.processSolsticeObjs(output[i], i);
                    }
                    this.createSolsticeImportRecord(JSON.stringify(output), httpStatus, errorCode, errorMessage, itopsErrorString);
                } else if (output.indexOf("splunklib.binding.AuthenticationError") > -1) {
                    this.createSolsticeImportRecord(output, httpStatus, errorCode, output, 'failed');
                } else {
                    this.createSolsticeImportRecord(output, httpStatus, errorCode, "The request failed:\n no available data from (/splunk/runquery).", 'failed');
                }
            } else {
                this.createSolsticeImportRecord(response.result.output, httpStatus, errorCode, errorMessage, response.result.status);
            }
        } else {
            this.createSolsticeImportRecord(JSON.stringify(response), httpStatus, errorCode, errorMessage, 'failed');
        }
    },

    processSolsticeObjs: function(obj, count) { //process individual solstice objects returned for target
        var payload = {};
        payload.items = [];
        payload.relations = [];
        var idObj = {};
        idObj.className = this.getRequestParams('ITOps Solstice API Import', 'targetCIClass');
        idObj.lookup = [];
        idObj.values = {};
        idObj.values['used_for'] = 'Production';
        idObj.values['short_description'] = this.getRequestParams('ITOps Solstice API Import', 'solsticeComments'); //moved to 'short_description', previously 'comments'
        idObj.values['firmware_manufacturer'] = this.getRequestParams('ITOps Solstice API Import', 'solsticeManufacturer');
        for (var keys in obj) {
            var attr = this.convertToSNOWFormatSolstice(keys);
            if (typeof idObj.values[attr] == 'undefined') {
                idObj.values[attr] = '';
            }
            /*
            //mac_address formatting
            if((attr == 'mac_address') && JSUtil.notNil(obj[keys])){
                idObj.values[attr] = obj[keys].match(/(.{1,2})/g).join(":");
            }
			*/
            //process manufacturer information
            if (attr == 'manufacturer') {
                idObj.values[attr] = this.getRequestParams('ITOps Solstice API Import', 'solsticeManufacturer');
            }
            //ip_address case handling /*if IP Address is empty that means that device is 'Non-Operational'*/
            else if (attr == 'operational_status') {
                idObj.values[attr] = '1';
                if (obj[keys] != "connected") {
                    idObj.values[attr] = '2';
                }
            }
            //process model_id
            else if ((attr == 'model_id') && JSUtil.notNil(obj[keys])) {
                idObj.values[attr] = this.fetchSolsticeModel(obj[keys]);
            }
            //process location information
            else if ((attr == 'location') && JSUtil.notNil(obj[keys])) {
                idObj.values[attr] = this.fetchLocation(obj[keys].toString());
            } else {
                idObj.values[attr] = obj[keys];
            }
        }
        payload.items.push(idObj);
        var jsonUntil = new JSON();
        payload = jsonUntil.encode(payload);
        sn_cmdb.IdentificationEngine.createOrUpdateCI('Splunk', payload);
    },

    createSolsticeImportRecord: function(response, httpStatus, errorCode, errorMessage, itopsErrorString) { //create logger record
        var importGr = new GlideRecord('u_itops_cmdb_ci_import');
        importGr.initialize();
        importGr.setValue('u_http_status', httpStatus);
        importGr.setValue('u_error_code', errorCode);
        importGr.setValue('u_error_string', errorMessage);
        importGr.setValue('u_itops_error_string', itopsErrorString);
        importGr.setValue('u_response', response);
        importGr.setValue('u_cmdb_ci_class', this.getRequestParams('ITOps Solstice API Import', 'targetCIClass'));
        importGr.setValue('u_processing_required', false);
        importGr.insert();
        return importGr.getUniqueValue();
    },

    convertToSNOWFormatSolstice: function(attribute) { //sync fields as in 'u_cmdb_ci_solstice_device' table
        var hashMap = {};
        hashMap['m_displayName'] = 'name';
        hashMap['m_displayId'] = 'correlation_id'; //labelled as display id
        hashMap['m_serverVersion'] = 'firmware_version';
        hashMap['ipaddress'] = 'ip_address';
        hashMap['m_productVariant'] = 'model_id';
        hashMap['m_productName'] = 'manufacturer';
        hashMap['status'] = 'operational_status';
        hashMap['Sitename'] = 'location';
        hashMap['m_productHardwareVersion'] = 'model_number';
        return hashMap[attribute];
    },

    fetchSolsticeModel: function(modelName) { //get Solstice Model
        var modelGr = new GlideRecord('cmdb_hardware_product_model');
        modelGr.addEncodedQuery('name=' + modelName);
        modelGr.query();
        if (modelGr.hasNext()) {
            modelGr.next();
            return modelGr.getUniqueValue();
        } else {
            modelGr.initialize();
            modelGr.name = modelName;
            modelGr.manufacturer = this.getRequestParams('ITOps Solstice API Import', 'solsticeManufacturer');
            modelGr.insert();
            return modelGr.getUniqueValue();
        }
    },

    purgeSolsticeImports: function() { //delete solstice imports aged more than 30 days
        var purgeGr = new GlideRecord('u_itops_cmdb_ci_import');
        purgeGr.addEncodedQuery('u_cmdb_ci_class=u_cmdb_ci_solstice_device^sys_created_on<javascript:gs.beginningOfLast30Days()');
        purgeGr.query();
        purgeGr.deleteMultiple();
    },

    executeTPConductorImport: function() { //Initiate Integration Process (TP - Conductors)
        var conductorRecords = this.getTPConductorInfoFromCMDB();
        var methods = JSON.parse(this.getTPConductorEndPointMapping());
        var resultSet = {};
        for (var i = 0; i < conductorRecords.length; i++) {
            if (typeof resultSet[conductorRecords[i]] == 'undefined') {
                resultSet[conductorRecords[i]] = {};
            }

            for (var keys in methods) {
                //gs.error("SSR >>> IP :: "+conductorRecords[i]+" ::: key :: "+keys+" ::: method :: "+methods[keys]);
                if (typeof resultSet[conductorRecords[i]][keys] == 'undefined') {
                    resultSet[conductorRecords[i]][keys] = '';
                }
                gs.sleep(2000);
                resultSet[conductorRecords[i]][keys] = this.getTPCondutorInformation(conductorRecords[i], methods[keys]);
                //gs.error(JSON.stringify(resultSet));
            }
        }
        this.createTPConductorImportRecord(resultSet, this.getRequestParams('Telepresence API Import', 'targetCIClass'));
    },

    getTPConductorInfoFromCMDB: function() { //get TP Conductor Information from CMDB
        var conductors = [];
        var tpGR = new GlideRecord(this.getRequestParams('Telepresence API Import', 'targetCIClass'));
        tpGR.addEncodedQuery(this.getRequestParams('Telepresence API Import', 'telepresenceQuery'));
        tpGR.query();
        while (tpGR.next()) {
            conductors.push(tpGR.getValue('ip_address') + '');
        }
        conductors = conductors.filter(function(item, pos) {
            return conductors.indexOf(item) == pos;
        });
        return conductors;
    },

    getTPConductorEndPointMapping: function() { //get all available methods on TP Conductors
        var endPoints = {};
        endPoints['dns_info'] = 'Get DNS Information';
        endPoints['sys_info'] = 'Get System Information';
        endPoints['nic_info'] = 'Get NIC Information';
        return JSON.stringify(endPoints);
    },

    getTPCondutorInformation: function(ip_addr, endPoint) { //get TP Conductor Information (REST)
        try {
            var request = new sn_ws.RESTMessageV2('Cisco TelePresence Conductors', endPoint);
            request.setStringParameterNoEscape('ip_address', ip_addr);
            request.setAuthentication('basic', this.getRequestParams('Telepresence API Import', 'credentials'));
            request.setMIDServer(this.getRequestParams('Telepresence API Import', 'requestMIDServer'));
            request.setEccParameter('skip_sensor', true);
            var response = request.execute();
            var result = {};
            result.responseBody = response.getBody();
            result.httpStatus = response.getStatusCode();
            result.errorCode = response.getErrorCode();
            result.errorMessage = response.getErrorMessage();
            return result;
        } catch (ex) {
            var message = ex.message;
            gs.error(message, 'Discovery: Cisco TP Conductor');
        }
    },

    createTPConductorImportRecord: function(response, ciClass) { //create logger records
        var importGr = new GlideRecord('u_itops_cmdb_ci_import');
        importGr.initialize();
        importGr.setValue('u_http_status', 0);
        importGr.setValue('u_error_code', 'NA');
        importGr.setValue('u_error_string', 'NA');
        importGr.setValue('u_itops_error_string', 'NA');
        importGr.setValue('u_response', JSON.stringify(response));
        importGr.setValue('u_cmdb_ci_class', ciClass + ' - conductor');
        importGr.setValue('u_processing_required', true);
        importGr.insert();
        return importGr.getUniqueValue();
    },

    purgeTPConductorImports: function() { //delete TP Conductor imports aged more than 30 days
        var purgeGr = new GlideRecord('u_itops_cmdb_ci_import');
        purgeGr.addEncodedQuery(this.getRequestParams('Telepresence API Import', 'purgeQuery'));
        purgeGr.query();
        purgeGr.deleteMultiple();
    },

    initiateTPConductorResponseProcessing: function(obj) {
        var response = obj.getValue('u_response');
        response = JSON.parse(response);
        var errorString = 'success';
        for (var keys00 in response) {
            for (var keys01 in response[keys00]) {
                if (response[keys00][keys01]['httpStatus'] != 200) {
                    errorString = 'failed';
                    break;
                }
            }
        }

        if (errorString == 'success') {
            for (var keys10 in response) {
                this.prepareCMDBObjJSONTPConductor(response[keys10], keys10);
            }
        }

        if (errorString == 'failed') {
            gs.error('REST API call failure', 'Discovery: Cisco TP Conductor');
        }

        obj.setValue('u_itops_error_string', errorString);
        obj.setValue('u_processing_required', false);
        obj.update();
    },

    prepareCMDBObjJSONTPConductor: function(obj, ipAddr) { //Pass payload to Identification engine
        var payload = {};
        payload.items = [];
        payload.relations = [];
        var idObj = {};
        idObj.className = this.getRequestParams('Telepresence API Import', 'targetCIClass');
        idObj.lookup = [];
        idObj.values = {};
        idObj.values.ip_address = ipAddr;
        idObj.values.used_for = 'Production';
        idObj.values.operational_status = '1';
        idObj.values.comments = 'Cisco Telepresence Conductor';

        for (var keys in obj) {
            if (keys == 'dns_info') {
                var dnsObj = JSON.parse(obj[keys]['responseBody'])[0]['records'][0];
                var hostName = dnsObj.host_name;
                var domainName = dnsObj.domain_name;
                idObj.values.name = hostName + '.' + domainName;
                idObj.values.fqdn = hostName + '.' + domainName;
                idObj.values.host_name = hostName;
                idObj.values.dns_domain = domainName;
            }
            if (keys == 'sys_info') {
                var sysObj = JSON.parse(obj[keys]['responseBody'])[0]['records'][0];
                idObj.values.os_version = sysObj.version_description;
                idObj.values.serial_number = sysObj.hardware_serial_number;
                idObj.values.model_id = this.getTPConductorModel(sysObj.product_name + ' - ' + sysObj.version_description);
            }
            if (keys == 'nic_info') {
                var nicObj = JSON.parse(obj[keys]['responseBody'])[0]['records'];
                idObj.values.mac_address = nicObj[0].mac_address; //mac_address is the same for all NICs, so returning the first element.
            }
        }

        payload.items.push(idObj);
        var jsonUntil = new JSON();
        payload = jsonUntil.encode(payload);
        sn_cmdb.IdentificationEngine.createOrUpdateCI('ServiceNow', payload);
    },

    getTPConductorModel: function(modelName) { //get Model for TP Conductor
        var modelGr = new GlideRecord('cmdb_hardware_product_model');
        modelGr.addEncodedQuery('name=' + modelName);
        modelGr.query();
        if (modelGr.hasNext()) {
            modelGr.next();
            return modelGr.getUniqueValue();
        } else {
            modelGr.initialize();
            modelGr.name = modelName;
            modelGr.manufacturer = this.getRequestParams('Telepresence API Import', 'tpConductorManufacturer');
            modelGr.insert();
            return modelGr.getUniqueValue();
        }
    },

    executeCiscoExpressWayImport: function() {
        var expressWayRecords = this.getCiscoExpressWayInfoFromCMDB();
        var methods = JSON.parse(this.getCiscoExpressWayEndPointMapping());
        var resultSet = {};
        for (var i = 0; i < expressWayRecords.length; i++) {
            if (typeof resultSet[expressWayRecords[i]] == 'undefined') {
                resultSet[expressWayRecords[i]] = {};
            }

            for (var keys in methods) {
                if (typeof resultSet[expressWayRecords[i]][keys] == 'undefined') {
                    resultSet[expressWayRecords[i]][keys] = '';
                }
                gs.sleep(1000);
                resultSet[expressWayRecords[i]][keys] = this.getCiscoExpressWayInformation(expressWayRecords[i], methods[keys]);
            }
        }
        this.createCiscoExpressWayImportRecord(resultSet, this.getRequestParams('CiscoExpressWay API Import', 'targetCIClass'));
    },

    getCiscoExpressWayInfoFromCMDB: function() {
        /*
        var expressWayRecords = [];
        var ewGr = new GlideRecord(this.getRequestParams('CiscoExpressWay API Import','targetCIClass'));
        ewGr.addEncodedQuery(this.getRequestParams('CiscoExpressWay API Import','expressWayQuery'));
        ewGr.setLimit(2);
        ewGr.query();
        while(ewGr.next()){
        	expressWayRecords.push(ewGr.getValue('ip_address')+'');
        }
        expressWayRecords = expressWayRecords.filter(function(item, pos){return expressWayRecords.indexOf(item)== pos;});
        */

        var expressWayRecords = this.getRequestParams('CiscoExpressWay API Import', 'expressWayIPs').toString().split(',');
        expressWayRecords = expressWayRecords.filter(function(item, pos) {
            return expressWayRecords.indexOf(item) == pos;
        });
        return expressWayRecords;

        /*
        var expressWayRecords = ['10.15.224.150','10.15.126.70'];
        return expressWayRecords;
        */
    },

    getCiscoExpressWayEndPointMapping: function() {
        var endPoints = {
            'sys_info': 'Get System Information',
            'dns_info': 'Get DNS Information',
            //'dns_server_info':'Get DNS Server Information', /*Commented this line as it's not required*/
            'overall_status': 'Get Overall System Status',
        };
        return JSON.stringify(endPoints);
    },

    getCiscoExpressWayInformation: function(ip_addr, endPoint) {
        try {
            var request = new sn_ws.RESTMessageV2('Cisco Expressway Devices', endPoint);
            request.setStringParameterNoEscape('ip_address', ip_addr);
            request.setAuthentication('basic', this.getRequestParams('CiscoExpressWay API Import', 'credentials'));
            request.setMIDServer(this.getRequestParams('CiscoExpressWay API Import', 'requestMIDServer'));
            request.setEccParameter('skip_sensor', true);
            var response = request.execute();
            var result = {};
            result.responseBody = '';
            if (endPoint == 'Get Overall System Status') {
                result.responseBody = gs.xmlToJSON(response.getBody());
                result.responseBody = this.stripDownJunkDataCiscoExpressWayImport(result.responseBody);
            } else {
                result.responseBody = JSON.parse(response.getBody());
            }
            result.httpStatus = response.getStatusCode();
            result.errorCode = response.getErrorCode();
            result.errorMessage = response.getErrorMessage();
            return result;
        } catch (ex) {
            var message = ex.message;
            gs.error(message, 'Discovery: Cisco Expressway Devices');
        }
    },

    stripDownJunkDataCiscoExpressWayImport: function(statsResult) {
        var result = {};
        result.softwareVersion = statsResult.Status.SystemUnit.Software.Version.content;
        result.softwareBuild = statsResult.Status.SystemUnit.Software.Build.content;
        result.softwareName = statsResult.Status.SystemUnit.Software.Name.content;
        result.hardwareSerialNumber = statsResult.Status.SystemUnit.Hardware.SerialNumber.content;
        result.hardwareVersion = statsResult.Status.SystemUnit.Hardware.Version.content;
        result.systemVersion = statsResult.Status.version.content;
        result.ipAddress = statsResult.Status.Ethernet[0].IPv4.Address.content;
        result.macAddress = statsResult.Status.Ethernet[0].MacAddress.content;
        return result;
    },

    createCiscoExpressWayImportRecord: function(response, ciClass) {
        var importGr = new GlideRecord('u_itops_cmdb_ci_import');
        importGr.initialize();
        importGr.setValue('u_http_status', 0);
        importGr.setValue('u_error_code', 'NA');
        importGr.setValue('u_error_string', 'NA');
        importGr.setValue('u_itops_error_string', 'NA');
        importGr.setValue('u_response', JSON.stringify(response));
        importGr.setValue('u_cmdb_ci_class', ciClass + ' - expressway');
        importGr.setValue('u_processing_required', true);
        importGr.insert();
        return importGr.getUniqueValue();
    },

    initiateCiscoExpressWayResponseProcessing: function(obj) {
        var response = obj.getValue('u_response');
        response = JSON.parse(response);

        var expectedCiCount = this.getCiscoExpressWayInfoFromCMDB().length;
        var expectedMethodCount = Object.keys(JSON.parse(this.getCiscoExpressWayEndPointMapping())).length;
        var actualCiCount = Object.keys(response).length;
        var errorString = '';
        var allSuccess = true;
        var successIPs = [];
        var failureIPs = [];

        for (var keys00 in response) {
            for (var keys01 in response[keys00]) {
                if (response[keys00][keys01]['httpStatus'] != 200) {
                    failureIPs.push(keys00);
                } else {
                    successIPs.push(keys00);
                }
            }
        }

        successIPs = successIPs.filter(function(item, pos) {
            return successIPs.indexOf(item) == pos;
        });
        failureIPs = failureIPs.filter(function(item, pos) {
            return failureIPs.indexOf(item) == pos;
        });

        if (failureIPs.length > 0) {
            allSuccess = false;
        }

        for (var i = 0; i < successIPs.length; i++) {
            this.prepareCMDBObjJSONCiscoExpressWay(response[successIPs[i]], successIPs[i]);

        }

        if (!allSuccess) {
            errorString += "All IP Addresses, didn't respond!\n";
        }

        for (var j = 0; j < failureIPs.length; j++) {
            errorString += "IP Address : " + failureIPs[j] + " didn't respond with necessary information, not enough data! \n";
        }

        obj.setValue('u_error_string', errorString);
        obj.setValue('u_processing_required', false);
        obj.update();
    },

    prepareCMDBObjJSONCiscoExpressWay: function(obj, ipAddr) { //Pass payload to Identification engine
        var payload = {};
        payload.items = [];
        payload.relations = [];
        var idObj = {};
        var softwareName = '';
        var prodModel = '';
        idObj.className = this.getRequestParams('CiscoExpressWay API Import', 'targetCIClass');
        idObj.lookup = [];
        idObj.values = {};
        idObj.values.ip_address = ipAddr;
        idObj.values.used_for = 'Production';
        idObj.values.operational_status = '1';
        idObj.values.comments = 'Cisco Expressway Devices';

        for (var keys in obj) {
            if (keys == 'dns_info') {
                var dnsObj = obj[keys].responseBody;
                idObj.values.name = dnsObj.SystemHostName + '.' + dnsObj.DomainName;
                idObj.values.fqdn = dnsObj.SystemHostName + '.' + dnsObj.DomainName;
                idObj.values.host_name = dnsObj.SystemHostName;
                idObj.values.dns_domain = dnsObj.DomainName;
            }
            if (keys == 'sys_info') {
                var sysObj = obj[keys].responseBody;
                idObj.values.os_version = sysObj.SoftwareVersion;
                prodModel += sysObj.ProductMode;
            }
            if (keys == 'overall_status') {
                var ovaObj = obj[keys].responseBody;
                idObj.values.os_service_pack = ovaObj.softwareName + ' - ' + ovaObj.softwareBuild; //softwareName - softwareBuild
                idObj.values.virtual = (ovaObj.hardwareVersion.toString().toLowerCase().indexOf('vmware') > -1) ? true : false;
                idObj.values.serial_number = ovaObj.hardwareSerialNumber;
                idObj.values.mac_address = ovaObj.macAddress;
                softwareName += ovaObj.softwareName;
            }
        }

        idObj.values.os = 'Ubuntu / Fedora / Tiny Core Linux / Linux 3.x'; //Used the same choice as updated in the cmdb_ci_server_appliance during the initial bulk import.
        idObj.values.model_id = this.getCiscoExpressWayModel(prodModel + ' - ' + softwareName);

        payload.items.push(idObj);
        var jsonUntil = new JSON();
        payload = jsonUntil.encode(payload);
        gs.error(payload);
        sn_cmdb.IdentificationEngine.createOrUpdateCI('ServiceNow', payload);
    },

    getCiscoExpressWayModel: function(modelName) { //get Model for CiscoExpressWay
        gs.error("modelName : " + modelName);
        var modelGr = new GlideRecord('cmdb_hardware_product_model');
        modelGr.addEncodedQuery('name=' + modelName);
        modelGr.query();
        if (modelGr.hasNext()) {
            modelGr.next();
            return modelGr.getUniqueValue();
        } else {
            modelGr.initialize();
            modelGr.name = modelName;
            modelGr.manufacturer = this.getRequestParams('CiscoExpressWay API Import', 'expresswayManufacturer');
            modelGr.insert();
            return modelGr.getUniqueValue();
        }
    },

    purgeCiscoExpressWayImports: function() { //delete TP Conductor imports aged more than 30 days
        var purgeGr = new GlideRecord('u_itops_cmdb_ci_import');
        purgeGr.addEncodedQuery(this.getRequestParams('CiscoExpressWay API Import', 'purgeQuery'));
        purgeGr.query();
        purgeGr.deleteMultiple();
    },

    executeIPPhoneImport: function() {
        var finalResultSet = {};
        finalResultSet.baseInfo = this.executeIPPhoneImportBaseInfo();
        finalResultSet.macSerialLink = this.executeIPPhoneImportMACToSerial();
        this.createPhoneImportRecord(JSON.stringify(finalResultSet), 0, 'NA', 'NA', 'NA');
    },

    executeIPPhoneImportBaseInfo: function() {
        var request = new sn_ws.RESTMessageV2('ITOps API', 'Get Phones');
        request.setRequestHeader(this.getRequestParams('ITOps CI Import', 'tokenName'), this.getRequestParams('ITOps CI Import', 'requestToken'));
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestBody(this.getRequestParams('ITOps Phone API Import', 'requestBodyBaseInfo'));
        request.setEndpoint(this.getRequestParams('ITOps CI Import', 'requestEndPoint'));
        var resultSet = {};
        var response = request.execute();
        resultSet.httpStatus = response.getStatusCode();
        resultSet.errorCode = response.getErrorCode();
        resultSet.errorMessage = response.getErrorMessage();
        response = JSON.parse(response.getBody());
        resultSet.itopsErrorString = response.result.status;
        var output = response.result.output;
        output = output.replace(/'/g, '"');
        resultSet.response = JSON.parse(output);
        return resultSet;
    },

    executeIPPhoneImportMACToSerial: function() {
        var request = new sn_ws.RESTMessageV2('ITOps API', 'Get Phones (MAC to Serial Map)');
        request.setRequestHeader(this.getRequestParams('ITOps CI Import', 'tokenName'), this.getRequestParams('ITOps CI Import', 'requestToken'));
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestBody(this.getRequestParams('ITOps Phone API Import', 'requestBodyMACtoSerial'));
        request.setEndpoint(this.getRequestParams('ITOps CI Import', 'requestEndPoint'));
        var resultSet = {};
        var response = request.execute();
        resultSet.httpStatus = response.getStatusCode();
        resultSet.errorCode = response.getErrorCode();
        resultSet.errorMessage = response.getErrorMessage();
        response = JSON.parse(response.getBody());
        resultSet.itopsErrorString = response.result.status;
        var output = response.result.output;
        output = output.replace(/'/g, '"');
        resultSet.response = JSON.parse(output);
        return resultSet;
    },

    initiateIpPhoneResponseProcessing: function(obj) {
        var response = obj.getValue('u_response');
        response = JSON.parse(response);
        var status = "success";

        for (var keys in response) {
            if (response[keys]['itopsErrorString'] == "failure") {
                status = "failure";
                break;
            }
        }

        if (status == "failure") {
            obj.setValue("u_error_string", "One of the REST calls failed, result cannot be processed further!");
        } else {
            var baseObj = response['baseInfo'].response;
            var macSerialLinkObj = response['macSerialLink'].response;
            macSerialLinkObj = this.buildKeyValuePair(macSerialLinkObj);
            for (var i = 0; i < baseObj.length; i++) {
                this.processPhoneObjs(baseObj[i], macSerialLinkObj, obj.getUniqueValue());
            }
        }

        obj.setValue("u_processing_required", false);
        obj.setValue("u_itops_error_string", status);
        obj.update();
        gs.sleep(parseInt(this.getRequestParams('ITOps Phone API Import', 'timer.processing.importFailure')));
        this.triggerFailureImportsIpPhone();
    },

    buildKeyValuePair: function(macSerialLinkObj) {
        var obj = {};
        for (var i = 0; i < macSerialLinkObj.length; i++) {
            var key = macSerialLinkObj[i].mac_address;
            if (typeof obj[key] == 'undefined') {
                obj[key] = macSerialLinkObj[i].serial_number;
            }
        }
        return obj;
    },

    processPhoneObjs: function(baseObj, linkObj, ciImport) {
        var payload = {};
        payload.items = [];
        payload.relations = [];
        var idObj = {};
        idObj.className = this.getRequestParams('ITOps Phone API Import', 'targetCIClass');
        idObj.lookup = [];
        idObj.values = {};
        idObj.values["used_for"] = "Production";
        for (var keys in baseObj) {
            var attr = this.convertToSNOWFormatIPPhone(keys);
            if (typeof idObj.values[attr] == 'undefined') {
                idObj.values[attr] = '';
            }
            //mac_address formatting
            if ((attr == 'mac_address') && JSUtil.notNil(baseObj[keys])) {
                idObj.values.serial_number = linkObj[baseObj[keys]];
                var tempVar = baseObj[keys].substring(3, baseObj[keys].length); //Strip out "SEP"
                idObj.values[attr] = tempVar.match(/(.{1,2})/g).join(":");
                idObj.values.name = baseObj[keys];
            }
            /*
            else if(attr == 'operational_status'){
				idObj.values[attr] = '1';
				if(baseObj[keys] != "registered"){
					idObj.values[attr] = '2';
					idObj.values["is_registered"] = false;
				}
				else{
					idObj.values["is_registered"] = true;
				}
            }
			*/
            //process model_id
            else if ((attr == 'model_id') && JSUtil.notNil(baseObj[keys])) {
                idObj.values[attr] = this.fetchIPPhoneModel(baseObj[keys]);
            }
            /*
            //process location information
            else if((attr == 'location') && JSUtil.notNil(baseObj[keys])){
                idObj.values[attr] = this.fetchLocation(baseObj[keys].toString());
            }
			*/
            else if ((attr == 'ip_address') && (baseObj[keys].toString().toLowerCase() == 'unknown')) {
                idObj.values[attr] = '';
            } else {
                idObj.values[attr] = baseObj[keys];
            }
        }

        if (!JSUtil.notNil(idObj.values.location)) {
            delete idObj.values.location;
        }

        for (var keys00 in idObj.values) {
            if (keys00 == "undefined") {
                delete idObj.values.undefined;
            }
        }

        this.createImportCounterRecordIPPhone(ciImport, idObj.values.name, idObj.values.serial_number, idObj.values.mac_address, this.getRequestParams('ITOps Phone API Import', 'targetCIClass'), idObj.values.is_registered);

        delete idObj.values.is_registered;

        payload.items.push(idObj);
        var jsonUntil = new JSON();
        payload = jsonUntil.encode(payload);

        var ciAction = JSON.parse(sn_cmdb.IdentificationEngine.identifyCI(JSON.stringify(payload)));
        if (ciAction.items[0].operation.toString() == 'INSERT') {
            payload.items[0].values['support_group'] = '';
            payload.items[0].values['support_group'] = this.getRequestParams('ITOps Phone API Import', 'ipPhoneSupportGroup');
        }

        sn_cmdb.IdentificationEngine.createOrUpdateCI('Splunk', payload);
    },

    convertToSNOWFormatIPPhone: function(attribute) {
        var hashMap = {
            'macaddress': 'mac_address',
            'location': 'location',
            'deviceIP': 'ip_address',
            'Model': 'model_id',
            'status': 'operational_status',
        };
        return hashMap[attribute];
    },

    fetchIPPhoneModel: function(modelName) {
        var modelGr = new GlideRecord('cmdb_hardware_product_model');
        modelGr.addEncodedQuery('name=' + modelName);
        modelGr.query();
        if (modelGr.hasNext()) {
            modelGr.next();
            return modelGr.getUniqueValue();
        } else {
            modelGr.initialize();
            modelGr.name = modelName;
            modelGr.manufacturer = this.getRequestParams('ITOps Phone API Import', 'ipPhoneManufacturer');
            modelGr.insert();
            return modelGr.getUniqueValue();
        }
    },

    createPhoneImportRecord: function(response, httpStatus, errorCode, errorMessage, itopsErrorString) { //create logger record
        var importGr = new GlideRecord('u_itops_cmdb_ci_import');
        importGr.initialize();
        importGr.setValue('u_http_status', httpStatus);
        importGr.setValue('u_error_code', errorCode);
        importGr.setValue('u_error_string', errorMessage);
        importGr.setValue('u_itops_error_string', itopsErrorString);
        importGr.setValue('u_response', response);
        importGr.setValue('u_cmdb_ci_class', this.getRequestParams('ITOps Phone API Import', 'targetCIClass'));
        importGr.setValue('u_processing_required', true);
        importGr.insert();
        return importGr.getUniqueValue();
    },

    createImportCounterRecordIPPhone: function(importRef, ciName, ciSerial, ciMAC, ciClass, registrationStatus) {
        var counterGr = new GlideRecord("u_itops_cmdb_ci_import_counter");
        counterGr.addEncodedQuery("u_ci_name=" + ciName);
        counterGr.query();
        if (counterGr.hasNext()) {
            counterGr.next();
            counterGr.setValue("u_total_imports", parseInt(counterGr.getValue("u_total_imports")) + 1);

            if (registrationStatus) {
                counterGr.setValue("u_import_failure_counter", 0);
            } else {
                counterGr.setValue("u_import_failure_counter", parseInt(counterGr.getValue("u_import_failure_counter")) + 1);
            }

            counterGr.setValue("u_ci_import", importRef);
            counterGr.setValue("u_ci_class", ciClass);
            counterGr.update();
        } else {
            counterGr.initialize();
            counterGr.setValue("u_total_imports", 1);

            if (registrationStatus) {
                counterGr.setValue("u_import_failure_counter", 0);
            } else {
                counterGr.setValue("u_import_failure_counter", 1);
            }

            counterGr.setValue("u_ci_import", importRef);
            counterGr.setValue("u_mac_address", ciMAC);

            if (typeof ciSerial != "undefined") {
                counterGr.setValue("u_serial_number", ciSerial);
            }

            counterGr.setValue("u_ci_name", ciName);
            counterGr.setValue("u_ci_class", ciClass);
            counterGr.insert();
        }
    },

    purgeImportCounterRecordIPPhone: function() {
        var query = this.getRequestParams("ITOps Phone API Import", "purgeQueryImportCounter");
        var counterGr = new GlideRecord("u_itops_cmdb_ci_import_counter");
        if (JSUtil.notNil(query)) {
            counterGr.addEncodedQuery(query);
        }
        counterGr.query();
        counterGr.deleteMultiple();
    },

    triggerFailureImportsIpPhone: function() {
        var jobId = this.getRequestParams("ITOps Phone API Import", "registrationFailureReportJobID");
        var triggerGr = new GlideRecord("sysauto_report");
        triggerGr.get(jobId);
        SncTriggerSynchronizer.executeNow(triggerGr);
    },

    executeZoomRoomDiscovery: function() {
        var totalPages, difference;
        var request = new sn_ws.RESTMessageV2("Zoom API", "List Zoom Rooms");
        request.setRequestHeader("Accept", "application/json, application/xml");
        request.setRequestHeader("Content-Type", "application/json");
        request.setRequestHeader("Authorization", "Bearer " + this.getRequestParams("Zoom API Import", "bearerToken"));
        request.setEndpoint(this.getRequestParams("Zoom API Import", "requestEndPoint"));
        request.setQueryParameter("page_size", this.getRequestParams("Zoom API Import", "objSize"));
        request.setQueryParameter("page_number", "1"); //Go with first page
        var finalSet = [];
        var resultSet = {};
        var response = request.execute();
        resultSet.httpStatus = response.getStatusCode();
        resultSet.errorCode = response.getErrorCode();
        resultSet.errorMessage = response.getErrorMessage();
        resultSet.response = JSON.parse(response.getBody());
        finalSet.push(resultSet);
        totalPages = parseInt(JSON.parse(response.getBody()).page_count);
        difference = totalPages - 1;
        for (var i = 2; i <= difference + 1; i++) {
            finalSet.push(this.executeZoomRoomDiscoveryPaginated(i));
        }
        this.finalizeZoomData(finalSet);
    },

    executeZoomRoomDiscoveryPaginated: function(pageNumber) {
        var request = new sn_ws.RESTMessageV2("Zoom API", "List Zoom Rooms");
        request.setRequestHeader("Accept", "application/json, application/xml");
        request.setRequestHeader("Content-Type", "application/json");
        request.setRequestHeader("Authorization", "Bearer " + this.getRequestParams("Zoom API Import", "bearerToken"));
        request.setEndpoint(this.getRequestParams("Zoom API Import", "requestEndPoint"));
        request.setQueryParameter("page_size", this.getRequestParams("Zoom API Import", "objSize"));
        request.setQueryParameter("page_number", pageNumber.toString());
        var resultSet = {};
        var response = request.execute();
        resultSet.httpStatus = response.getStatusCode();
        resultSet.errorCode = response.getErrorCode();
        resultSet.errorMessage = response.getErrorMessage();
        resultSet.response = JSON.parse(response.getBody());
        return resultSet;
    },

    finalizeZoomData: function(resultSet) {
        var recordSets = {};
        var comments = "";
        for (var i = 0; i < resultSet.length; i++) {
            if (resultSet[i].httpStatus != 200) {
                comments += "Call returned with the http status : " + resultSet[i].httpStatus + "\n" + "Error is " + resultSet[i].errorMessage + "\n";
            } else {
                recordSets[i] = resultSet[i].response.zoom_rooms;
            }
        }

        if (!comments) {
            this.createZoomRoomImportRecord(JSON.stringify(recordSets), 200, 0, "", "success");
        } else {
            this.createZoomRoomImportRecord(JSON.stringify(recordSets), 0, 0, comments, "failed");
        }
    },

    createZoomRoomImportRecord: function(response, httpStatus, errorCode, errorMessage, itopsErrorString) {
        var importGr = new GlideRecord("u_itops_cmdb_ci_import");
        importGr.initialize();
        importGr.setValue("u_http_status", httpStatus);
        importGr.setValue("u_error_code", errorCode);
        importGr.setValue("u_error_string", errorMessage);
        importGr.setValue("u_itops_error_string", itopsErrorString);
        importGr.setValue("u_response", response);
        importGr.setValue("u_cmdb_ci_class", this.getRequestParams("Zoom API Import", "targetCIClass"));
        importGr.setValue("u_processing_required", true);
        importGr.insert();
        return importGr.getUniqueValue();
    },

    initiateZoomRoomResponseProcessing: function(obj) {
        var dataSets = JSON.parse(obj.getValue("u_response"));
        for (var keys in dataSets) {
            for (var i = 0; i < dataSets[keys].length; i++) {
                if (this.getRequestParams("Zoom API Import", "includeDisplayDevices") == "false") { //Include zoom instances with the string "Display" as part of the name.
                    if (dataSets[keys][i]["room_name"].toString().toLowerCase().indexOf("display") == -1) {
                        this.processZoomRoomObjs(dataSets[keys][i]);
                    }
                } else {
                    this.processZoomRoomObjs(dataSets[keys][i]);
                }
            }
        }
        obj.setValue("u_processing_required", false);
        obj.update();
    },

    processZoomRoomObjs: function(baseObj) {
        var ignorantAttributes = this.getRequestParams("Zoom API Import", "ignoreAttributes");
        var payload = {};
        payload.items = [];
        payload.relations = [];
        var idObj = {};
        idObj.className = this.getRequestParams("Zoom API Import", "targetCIClass");
        idObj.lookup = [];
        idObj.values = {};
        idObj.values["used_for"] = "Production";
        for (var keys in baseObj) {
            if (ignorantAttributes.indexOf(keys) == -1) {
                var attr = this.convertToSNOWFormatZoomRoom(keys);

                if (typeof idObj.values[attr] == 'undefined') {
                    idObj.values[attr] = '';
                }

                idObj.values[attr] = baseObj[keys];
            }
        }

        // Populate location from IP Address (Priority: Controller > Computer or Digital Signage Only)
        var ipAddresses = baseObj.device_ip.match(/[0-9]+(?:\.[0-9]+){2}/g); // First 3 octets of IPV4 Regex Pattern
        var site = '';
        if (ipAddresses) {
            if (ipAddresses.length == 1) {
                site = this.getInfobloxSiteFromIPAddress(ipAddresses[0]+".");
            } else {
                // Get Controller IP Address (usually second IP)
                site = this.getInfobloxSiteFromIPAddress(ipAddresses[1]+".");
            }
        }
        idObj.values["location"] = this.fetchLocation(site); // Empty if site is empty OR not present in data center table AND otherSiteCodes
        if (!JSUtil.notNil(idObj.values.location)) {
            delete idObj['values']['location'];  // If location comes empty from Infoblox, do not update it. May contain user entered location.
        }

        payload.items.push(idObj);
        var jsonUntil = new JSON();
        payload = jsonUntil.encode(payload);
        sn_cmdb.IdentificationEngine.createOrUpdateCI('Splunk', payload);
    },

    convertToSNOWFormatZoomRoom: function(attribute) {
        var hashMap = {
            "account_type": "u_account_type",
            "room_name": "name",
            "microphone": "u_microphone",
            "speaker": "u_speaker",
            "camera": "u_camera",
            "calendar_name": "u_calendar_name",
            "id": "correlation_id",
            "email": "u_email",
            "device_ip": "ip_address",
            "last_start_time": "u_last_start_time",
            "status": "u_room_status"
        };
        return hashMap[attribute];
    },

    getInfobloxSiteFromIPAddress: function(ipAddress) {
        var ibn = new GlideRecord("x_snc_ib_ipam_network");
        ibn.addQuery("network","STARTSWITH",ipAddress);
        ibn.query();
        if (ibn.next()) {
            return ibn.site.name;
        }
        return '';
    },

    purgeZoomRoomImports: function() {
        var purgeGr = new GlideRecord("u_itops_cmdb_ci_import");
        purgeGr.addEncodedQuery(this.getRequestParams("Zoom API Import", "purgeQuery"));
        purgeGr.query();
        purgeGr.deleteMultiple();
    },

    executeCiscoVCSImport: function() {
        var VCSRecords = this.getCiscoVCSInfoFromCMDB();
        var methods = JSON.parse(this.getCiscoVCSEndPointMapping());
        var resultSet = {};
        for (var i = 0; i < VCSRecords.length; i++) {
            if (typeof resultSet[VCSRecords[i]] == 'undefined') {
                resultSet[VCSRecords[i]] = {};
            }

            for (var keys in methods) {
                if (typeof resultSet[VCSRecords[i]][keys] == 'undefined') {
                    resultSet[VCSRecords[i]][keys] = '';
                }
                gs.sleep(1000);
                resultSet[VCSRecords[i]][keys] = this.getCiscoVCSInformation(VCSRecords[i], methods[keys]);
            }
        }
        this.createCiscoVCSImportRecord(resultSet, this.getRequestParams('CiscoVCS API Import', 'targetCIClass'));
    },

    getCiscoVCSInfoFromCMDB: function() { //Currently pulled from ITSRT Automation Command Center
        var VCSRecords = this.getRequestParams('CiscoVCS API Import', 'VCSIPs').toString().split(',');
        VCSRecords = VCSRecords.filter(function(item, pos) {
            return VCSRecords.indexOf(item) == pos;
        });
        return VCSRecords;
    },

    getCiscoVCSEndPointMapping: function() {
        var endPoints = {
            'sys_info': 'Get System Information',
            'dns_info': 'Get DNS Information',
            'overall_status': 'Get Overall System Status',
        };
        return JSON.stringify(endPoints);
    },

    getCiscoVCSInformation: function(ip_addr, endPoint) { //Get VCS Device Information
        try {
            var request = new sn_ws.RESTMessageV2('Cisco VCS Devices', endPoint);
            request.setStringParameterNoEscape('ip_address', ip_addr);
            request.setAuthentication('basic', this.getRequestParams('CiscoVCS API Import', 'credentials'));
            request.setMIDServer(this.getRequestParams('CiscoVCS API Import', 'requestMIDServer'));
            request.setEccParameter('skip_sensor', true);
            var response = request.execute();
            var result = {};
            result.responseBody = '';
            if (endPoint == 'Get Overall System Status') {
                result.responseBody = gs.xmlToJSON(response.getBody());
                result.responseBody = this.stripDownJunkDataCiscoVCSImport(result.responseBody);
            } else {
                result.responseBody = JSON.parse(response.getBody());
            }
            result.httpStatus = response.getStatusCode();
            result.errorCode = response.getErrorCode();
            result.errorMessage = response.getErrorMessage();
            return result;
        } catch (ex) {
            var message = ex.message;
            gs.error(message, 'Discovery: Cisco VCS Devices');
        }
    },

    stripDownJunkDataCiscoVCSImport: function(statsResult) { //Process System Information
        var result = {};
        result.softwareVersion = statsResult.Status.SystemUnit.Software.Version.content;
        result.softwareBuild = statsResult.Status.SystemUnit.Software.Build.content;
        result.softwareName = statsResult.Status.SystemUnit.Software.Name.content;
        result.hardwareSerialNumber = statsResult.Status.SystemUnit.Hardware.SerialNumber.content;
        result.hardwareVersion = statsResult.Status.SystemUnit.Hardware.Version.content;
        result.systemVersion = statsResult.Status.version.content;
        result.ipAddress = statsResult.Status.Ethernet[0].IPv4.Address.content;
        result.macAddress = statsResult.Status.Ethernet[0].MacAddress.content;
        return result;
    },

    createCiscoVCSImportRecord: function(response, ciClass) { //Create VCS Import Record
        var importGr = new GlideRecord('u_itops_cmdb_ci_import');
        importGr.initialize();
        importGr.setValue('u_http_status', 0);
        importGr.setValue('u_error_code', 'NA');
        importGr.setValue('u_error_string', 'NA');
        importGr.setValue('u_itops_error_string', 'NA');
        importGr.setValue('u_response', JSON.stringify(response));
        importGr.setValue('u_cmdb_ci_class', ciClass + ' - vcs');
        importGr.setValue('u_processing_required', true);
        importGr.insert();
        return importGr.getUniqueValue();
    },

    initiateCiscoVCSResponseProcessing: function(obj) { //Processing notes & comments
        var response = obj.getValue('u_response');
        response = JSON.parse(response);

        var expectedCiCount = this.getCiscoVCSInfoFromCMDB().length;
        var expectedMethodCount = Object.keys(JSON.parse(this.getCiscoVCSEndPointMapping())).length;
        var actualCiCount = Object.keys(response).length;
        var errorString = '';
        var allSuccess = true;
        var successIPs = [];
        var failureIPs = [];

        for (var keys00 in response) {
            for (var keys01 in response[keys00]) {
                if (response[keys00][keys01]['httpStatus'] != 200) {
                    failureIPs.push(keys00);
                } else {
                    successIPs.push(keys00);
                }
            }
        }

        successIPs = successIPs.filter(function(item, pos) {
            return successIPs.indexOf(item) == pos;
        });
        failureIPs = failureIPs.filter(function(item, pos) {
            return failureIPs.indexOf(item) == pos;
        });

        if (failureIPs.length > 0) {
            allSuccess = false;
        }

        for (var i = 0; i < successIPs.length; i++) {
            this.prepareCMDBObjJSONCiscoVCS(response[successIPs[i]], successIPs[i]);

        }

        if (!allSuccess) {
            errorString += "All IP Addresses, didn't respond!\n";
        }

        for (var j = 0; j < failureIPs.length; j++) {
            errorString += "IP Address : " + failureIPs[j] + " didn't respond with necessary information, not enough data! \n";
        }

        obj.setValue('u_error_string', errorString);
        obj.setValue('u_processing_required', false);
        obj.update();
    },

    prepareCMDBObjJSONCiscoVCS: function(obj, ipAddr) { //Pass payload to Identification engine
        var payload = {};
        payload.items = [];
        payload.relations = [];
        var idObj = {};
        var softwareName = '';
        var prodModel = '';
        idObj.className = this.getRequestParams('CiscoVCS API Import', 'targetCIClass');
        idObj.lookup = [];
        idObj.values = {};
        idObj.values.ip_address = ipAddr;
        idObj.values.used_for = 'Production';
        idObj.values.operational_status = '1';
        idObj.values.comments = 'Cisco VCS Devices';

        for (var keys in obj) {
            if (keys == 'dns_info') {
                var dnsObj = obj[keys].responseBody;
                idObj.values.name = dnsObj.SystemHostName + '.' + dnsObj.DomainName;
                idObj.values.fqdn = dnsObj.SystemHostName + '.' + dnsObj.DomainName;
                idObj.values.host_name = dnsObj.SystemHostName;
                idObj.values.dns_domain = dnsObj.DomainName;
            }
            if (keys == 'sys_info') {
                var sysObj = obj[keys].responseBody;
                idObj.values.os_version = sysObj.SoftwareVersion;
                prodModel += sysObj.ProductMode;
            }
            if (keys == 'overall_status') {
                var ovaObj = obj[keys].responseBody;
                idObj.values.os_service_pack = ovaObj.softwareName + ' - ' + ovaObj.softwareBuild; //softwareName - softwareBuild
                idObj.values.virtual = (ovaObj.hardwareVersion.toString().toLowerCase().indexOf('vmware') > -1) ? true : false;
                idObj.values.serial_number = ovaObj.hardwareSerialNumber;
                idObj.values.mac_address = ovaObj.macAddress;
                softwareName += ovaObj.softwareName;
            }
        }

        idObj.values.os = 'Ubuntu / Fedora / Tiny Core Linux / Linux 3.x'; //Used the same choice as updated in the cmdb_ci_server_appliance during the initial bulk import.
        idObj.values.model_id = this.getCiscoVCSModel(prodModel + ' - ' + softwareName);

        payload.items.push(idObj);
        var jsonUntil = new JSON();
        payload = jsonUntil.encode(payload);
        gs.error(payload);
        sn_cmdb.IdentificationEngine.createOrUpdateCI('ServiceNow', payload);
    },

    getCiscoVCSModel: function(modelName) { //get Model for CiscoVCS
        var modelGr = new GlideRecord('cmdb_hardware_product_model');
        modelGr.addEncodedQuery('name=' + modelName);
        modelGr.query();
        if (modelGr.hasNext()) {
            modelGr.next();
            return modelGr.getUniqueValue();
        } else {
            modelGr.initialize();
            modelGr.name = modelName;
            modelGr.manufacturer = this.getRequestParams('CiscoVCS API Import', 'VCSManufacturer');
            modelGr.insert();
            return modelGr.getUniqueValue();
        }
    },

    purgeCiscoVCSImports: function() { //delete VCS imports aged more than 30 days
        var purgeGr = new GlideRecord('u_itops_cmdb_ci_import');
        purgeGr.addEncodedQuery(this.getRequestParams('CiscoVCS API Import', 'purgeQuery'));
        purgeGr.query();
        purgeGr.deleteMultiple();
    },
	
	executeCiscoUCOSImport: function() { //Execute the Cisco UCOS discovery
		var records = this.getCiscoUCOSRecords();	
		records = records.filter(function(item, pos) {
            return records.indexOf(item) == pos;
        });
		
		if(typeof records !== "undefined"){		
			this.launchJSProbesForEachCiscoUCOS(records);
		}
	},

	getCiscoUCOSRecords: function() { //Fetch Operational CIs of Cisco UCOS Servers from CMDB
		var ucosGr = new GlideRecord("u_cmdb_ci_server_cisco_ucos");
		ucosGr.addEncodedQuery(this.getRequestParams('CiscoUCOS Import', 'scopeFilter'));
		ucosGr.query();
		var ciList = [];
		while(ucosGr.next()){
			ciList.push(ucosGr.getValue("ip_address"));
		}
		
		if(ciList.length > 0){
			return ciList;
		}
		else{
			return undefined;
		}
	},
	
	launchJSProbesForEachCiscoUCOS: function(sources) { //Sources to be targeted.
		/*
		sources.forEach(function(item){
			gs.error("Cisco UCOS :: item :: "+item);
			this.createJSProbeInstanceCiscoUCOS(item);
		});
		*/
		for(var i = 0; i < sources.length; i++){
			this.createJSProbeInstanceCiscoUCOS(sources[i]);
		}
	},
	
	createJSProbeInstanceCiscoUCOS: function(ip) { //Create a JS probe instance with commands against a specific IP Address
		var jspr = new JavascriptProbe(this.getRequestParams('CiscoUCOS Import', 'eccAgent'));
		jspr.setName('SSHTerminalCommand');
		jspr.setSource(ip);
		jspr.addParameter('cli_commands', this.getRequestParams('CiscoUCOS Import', 'cliCommands'));
		jspr.addParameter('ignore_stderr', 'true');
		jspr.addParameter('target_ip',ip);
		jspr.addParameter('allow_unsupported_shells', 'true');
		jspr.addParameter('ci_class', this.getRequestParams('CiscoUCOS Import', 'targetCIClass'));
		jspr.addParameter('probe',this.getRequestParams('CiscoUCOS Import', 'probeId'));
		jspr.create();
	},

	identifyOrUpdateCI_CiscoUCOS: function(hostname, hostdomain, lic_mac, mac_addr, cpu_cnt, cpu_spd, cpu_type,os_ver, vm_serial, mem_ram, ip_addr, disk_size_gb,short_desc){
		
		/*
		Payload generation part
		*/
		
		var payload = {};
        payload.items = [];
        payload.relations = [];
        var idObj = {};
        var softwareName = '';
        var prodModel = '';
        idObj.className = this.getRequestParams('CiscoUCOS Import', 'targetCIClass');
        idObj.lookup = [];
        idObj.values = {};
        idObj.values.ip_address = ip_addr;
		idObj.values.short_description = short_desc;
		idObj.values.name = hostname + '.' + hostdomain;
		idObj.values.fqdn = hostname + '.' + hostdomain;
		idObj.values.host_name = hostname;
		idObj.values.dns_domain = hostdomain;
		idObj.values.os_version = os_ver;
		idObj.values.cpu_type = cpu_type;
		idObj.values.cpu_count = cpu_cnt;
		idObj.values.cpu_speed = cpu_spd;
		idObj.values.os = "Cisco Unified Communications OS";
		idObj.values.mac_address = mac_addr;
		idObj.values.u_license_mac = this.processLicenseMACAddressCiscoUCOS(lic_mac);
		idObj.values.disk_space = disk_size_gb;
		idObj.values.serial_number = vm_serial;
		idObj.values.ram = mem_ram;
		idObj.values.virtual = (vm_serial.toString().toLowerCase().indexOf('vmware') > -1) ? true : false;
        idObj.values.model_id = this.getRequestParams("CiscoUCOS Import",'existingSURFModel');

        payload.items.push(idObj);
        var jsonUntil = new JSON();
        payload = jsonUntil.encode(payload);
		
        sn_cmdb.IdentificationEngine.createOrUpdateCI('ServiceNow', payload); //Passing the values to the IDE
	},
	
	processLicenseMACAddressCiscoUCOS: function(mac) {
		if(typeof mac === "undefined"){
			return "";
		}
		else{
			return mac.toString().match(/(.{1,2})/g).join(":");
		}
	},
	
    type: 'ciImportUtils'
});