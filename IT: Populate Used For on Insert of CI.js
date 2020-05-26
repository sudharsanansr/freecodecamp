(function executeRule(current, previous /*null when async*/ ) {

	gs.info('Execution of IT: Populate Used For on Insert of CI :: Used for :: '+current.getValue('used_for'));
    // Add your code here
    var utils = new ITSRTAutomationUtil();
    var classes = (utils.getProbeScript('ciUsedForOverrides', 'classConsidered')).split(',');
    if(classes.indexOf(current.getValue('sys_class_name')) > -1){
		if(JSUtil.nil(current.getValue('u_vm_instance'))){ //if VM Reference is not tagged to the server
			gs.info('LM: BR Triggered - IT: Populate Used For on Insert of CI inside the IF block');
			current.setValue('used_for','Not Determined');
			
			/*
			*** LogicMonitor Bug Fix ***
            Server CIs without VMs are updated with LogicMonitor Enable as "TRUE", even when they don't have an VM or the VM environment not found!
            
            The culprit is https://surf.service-now.com/nav_to.do?uri=sys_dictionary.do?sys_id=12abc41935512100184d61e3ee328f14%26sysparm_view=advanced
			*/
			
			current.setValue('x_lomo_lmcmdbint_logicmonitor_enable',false);
		}
	}

})(current, previous);