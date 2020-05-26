(function() {
    var importGr = new GlideRecord('u_lm_cmdb_data_import');
    importGr.query();

    if (new ITSRTCommonUtils().getRequestParams('LM_CMDB_Integration', 'proposedJSONFormat').toString().toLowerCase() === 'new') {
        while (importGr.next()) {
            var jsonObjNew = {};
            jsonObjNew.deviceProperties = {};
            jsonObjNew.deviceProperties.impact = importGr.getValue('u_top_impact');
            jsonObjNew.deviceProperties.urgency = importGr.getValue('u_top_urgency');
            jsonObjNew.deviceProperties.assignment_group = importGr.getValue('u_top_evt_assignment_group');
            jsonObjNew.deviceProperties.business_service = importGr.getValue('u_top_business_service');
            jsonObjNew.deviceProperties.category = importGr.getValue('u_top_category');
            jsonObjNew.deviceProperties.sub_category = importGr.getValue('u_top_sub_category');
            jsonObjNew.threshold_settings = {};
            jsonObjNew.threshold_settings.cpu = {};
            jsonObjNew.threshold_settings.cpu.properties = {};
            jsonObjNew.threshold_settings.cpu.properties.mute = false;
            jsonObjNew.threshold_settings.cpu.properties.impact = importGr.getValue('u_cpu_impact');
            jsonObjNew.threshold_settings.cpu.properties.urgency = importGr.getValue('u_cpu_urgency');
            jsonObjNew.threshold_settings.cpu.properties.assignment_group = importGr.getValue('u_top_evt_assignment_group');
            jsonObjNew.threshold_settings.cpu.properties.business_service = importGr.getValue('u_top_business_service');
            jsonObjNew.threshold_settings.cpu.properties.category = importGr.getValue('u_top_category');
            jsonObjNew.threshold_settings.cpu.properties.sub_category = importGr.getValue('u_top_sub_category');
            jsonObjNew.threshold_settings.cpu.thresholds = {};
            jsonObjNew.threshold_settings.cpu.thresholds.warning = 80;
            jsonObjNew.threshold_settings.cpu.thresholds.critical = 90;
            jsonObjNew.threshold_settings.memory = {};
            jsonObjNew.threshold_settings.memory.properties = {};
            jsonObjNew.threshold_settings.memory.properties.mute = false;
            jsonObjNew.threshold_settings.memory.properties.impact = importGr.getValue('u_memory_impact');
            jsonObjNew.threshold_settings.memory.properties.urgency = importGr.getValue('u_memory_urgency');
            jsonObjNew.threshold_settings.memory.properties.assignment_group = importGr.getValue('u_top_evt_assignment_group');
            jsonObjNew.threshold_settings.memory.properties.business_service = importGr.getValue('u_top_business_service');
            jsonObjNew.threshold_settings.memory.properties.category = importGr.getValue('u_top_category');
            jsonObjNew.threshold_settings.memory.properties.sub_category = importGr.getValue('u_top_sub_category');
            jsonObjNew.threshold_settings.memory.thresholds = {};
            jsonObjNew.threshold_settings.memory.thresholds.warning = 80;
            jsonObjNew.threshold_settings.memory.thresholds.critical = 90;
            gs.error('Genereated payload: \n' + JSON.stringify(jsonObjNew));
        }
    }
	else{
		while (importGr.next()) {
			var jsonObjOld = {};
			jsonObjOld.evt_impact = importGr.getValue('u_top_impact');
			jsonObjOld.evt_urgency = importGr.getValue('u_top_urgency');
			jsonObjOld.evt_ag = importGr.getValue('u_top_evt_assignment_group');
			jsonObjOld.evt_bs = importGr.getValue('u_top_business_service');
			jsonObjOld.evt_category = importGr.getValue('u_top_category');
			jsonObjOld.evt_sub_category = importGr.getValue('u_top_sub_category');
			if((importGr.getValue('u_cpu_impact').toString().toLowerCase() !== 'na') || (importGr.getValue('u_cpu_urgency').toString().toLowerCase() !== 'na')){
				jsonObjOld.CPU = {};
				jsonObjOld.CPU.ds_ag = importGr.getValue('u_top_evt_assignment_group');
				jsonObjOld.CPU.ds_bs = importGr.getValue('u_top_business_service');
				jsonObjOld.CPU.ds_category = importGr.getValue('u_top_category');
				jsonObjOld.CPU.ds_sub_category = importGr.getValue('u_top_sub_category');
				jsonObjOld.CPU.ds_mute = false;
				jsonObjOld.CPU.CPU_Util = {};
				jsonObjOld.CPU.CPU_Util.dp_impact = importGr.getValue('u_cpu_impact');
				jsonObjOld.CPU.CPU_Util.dp_urgency = importGr.getValue('u_cpu_urgency');
				jsonObjOld.CPU.CPU_Util.dp_wt = 80;
				jsonObjOld.CPU.CPU_Util.dp_ct = 90;
				jsonObjOld.CPU.CPU_Util.dp_mute = false;
			}
			if((importGr.getValue('u_memory_impact').toString().toLowerCase() !== 'na') || (importGr.getValue('u_memory_urgency').toString().toLowerCase() !== 'na')){
				jsonObjOld.Memory = {};
				jsonObjOld.Memory.ds_ag = importGr.getValue('u_top_evt_assignment_group');
				jsonObjOld.Memory.ds_bs = importGr.getValue('u_top_business_service');
				jsonObjOld.Memory.ds_category = importGr.getValue('u_top_category');
				jsonObjOld.Memory.ds_sub_category = importGr.getValue('u_top_sub_category');
				jsonObjOld.Memory.ds_mute = false;
				jsonObjOld.Memory.Memory_Util = {};
				jsonObjOld.Memory.Memory_Util.dp_impact = importGr.getValue('u_memory_impact');
				jsonObjOld.Memory.Memory_Util.dp_urgency = importGr.getValue('u_memory_urgency');
				jsonObjOld.Memory.Memory_Util.dp_wt = 80;
				jsonObjOld.Memory.Memory_Util.dp_ct = 90;
				jsonObjOld.Memory.Memory_Util.dp_mute = false;
			}
			gs.error('Genereated payload: \n' + JSON.stringify(jsonObjOld));
		}
	}


})();