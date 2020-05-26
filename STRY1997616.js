(function(){
	var ciClasses = new ITSRTCommonUtils().getRequestParams('LM_CMDB_Integration','applicableCiClasses');
	
	if(ciClasses.indexOf(',') > -1){
		ciClasses = ciClasses.split(',');
	}
	else if(ciClasses.toString().toLowerCase() === 'all'){
		ciClasses = [];
		ciClasses.push('cmdb_ci');
	}
	else{
		gs.error('LM Integration: not able to run the code for fix script "STRY1997616_CILocationCodePopulation"');
		return;
	}
	
	if(Array.isArray(ciClasses)){
		for(var i = 0; i < ciClasses.length; i++ ){
			var ciGr = new GlideRecord(ciClasses[i]);
			ciGr.addEncodedQuery('locationISNOTEMPTY');
			ciGr.query();
			while(ciGr.next()){
				if(JSUtil.notNil(ciGr.getValue('location'))){
					var locationCode = fetchLocationCode(ciGr.getValue('location'));
					if((JSUtil.notNil(locationCode)) && (JSUtil.notNil(ciGr.getValue('u_ci_data_center')))){
						ciGr.setValue('u_ci_data_center',locationCode);
						ciGr.setWorkflow(false);
						ciGr.update();
					}
				}	
			}
		}
	}		
}());

function fetchLocationCode(id){
	var dcGr = new GlideRecord('cmdb_ci_datacenter');
	dcGr.addEncodedQuery('location='+id+'^u_active=true');
	dcGr.orderBy('sys_created_on');
	dcGr.query();
	if(dcGr.next()){
		return dcGr.getUniqueValue();
	}
}