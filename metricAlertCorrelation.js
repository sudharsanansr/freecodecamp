(function executeRule(current, previous /*null when async*/) {

	// Add your code here
	var obj = {};
	obj.sysid_group = current.getValue("group_id");
	obj.id_group = current.getDisplayValue("group_id");
	obj.sysid_secondary_alert = current.getValue("alert_id");
	obj.id_secondary_alert = current.getDisplayValue("alert_id");
	obj.sysid_correlation_rule = current.getValue("source_rule");
	obj.id_correlation_rule = current.getDisplayValue("source_rule");
	
	var aggGrpGr = new GlideRecord("em_agg_group");
	aggGrpGr.get(obj.sysid_group);
	
	if(JSUtil.notNil(aggGrpGr)){
		obj.sysid_primary_alert = aggGrpGr.getValue("primary_alert_id");
		obj.id_primary_alert = aggGrpGr.getDisplayValue("primary_alert_id");
	}
	else{
		obj.sysid_primary_alert = null;
		obj.id_primary_alert = null;
	}
	
	var metricGr = new GlideRecord("x_snc_aiops_comman_metrics");
	metricGr.initialize();
	metricGr.setValue("payload",JSON.stringify(obj));
	metricGr.setValue("values",obj.id_secondary_alert);
	metricGr.setValue("correlation_rule",obj.sysid_correlation_rule);
	metricGr.setValue("primary_alert",obj.id_primary_alert);
	metricGr.setValue("status","Grouped");
	metricGr.setValue("type","alert_correlation");
	metricGr.setValue("group_id",obj.id_group);
	metricGr.insert();
	
})(current, previous);