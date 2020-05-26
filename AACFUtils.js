var AACFUtils = Class.create();
AACFUtils.prototype = {
    initialize: function(alertGr) {
        this.alert = alertGr;
    },

    process: function(ciFilterParameter) {
        if (this.isDumpsterRuleActive()) {
            return this.processDumpsterRules(this.alert, ciFilterParameter);
        }
    },

    isDumpsterRuleActive: function() {
        var aacfGa = new GlideAggregate('u_advanced_alert_correlation_configuration');
        aacfGa.addEncodedQuery('u_active=true');
        aacfGa.addAggregate('COUNT');
        aacfGa.query();
        if (aacfGa.next()) {
            if (aacfGa.getAggregate('COUNT') > 0) {
                return true;
            }
        }
        return false;
    },

    processDumpsterRules: function(obj, ciFilter) {
        var matchingConfig = this.getMatchingConfig(obj.getUniqueValue());
        this.printLog(JSON.stringify(matchingConfig));
        if (JSUtil.notNil(matchingConfig)) {
            var count = 0;
            var alertGa = new GlideAggregate('em_alert');
            if (JSUtil.notNil(ciFilter)) {
                alertGa.addEncodedQuery(matchingConfig.query.replace('^EQ', '') + '^cmdb_ci.' + ciFilter + '=' + obj.cmdb_ci.sys_class_name + '^correlation_group!=2^state!=Closed^sys_id!=' + obj.getUniqueValue());
            } else {
                alertGa.addEncodedQuery(matchingConfig.query.replace('^EQ', '') + '^correlation_group!=2^state!=Closed^sys_id!=' + obj.getUniqueValue());
            }
            this.printLog(alertGa.getEncodedQuery());
            alertGa.addAggregate('COUNT');
            alertGa.query();
            if (alertGa.next()) {
                count = alertGa.getAggregate('COUNT');
            }
            this.printLog('processDumpsterRules() :: count :: ' + count);
            this.printLog('processDumpsterRules() :: matchingConfig.alert_count :: ' + matchingConfig.alert_count);
			var pAlert;
            var result = {};
            if (count == matchingConfig.alert_count) {
				
				if (JSUtil.nil(ciFilter)) {
                    pAlert = this.verifyPrimaryExistence(matchingConfig.query.replace('^EQ', '') + '^cmdb_ci.' + ciFilter + '=' + obj.cmdb_ci.sys_class_name + '^correlation_group!=2^state!=Closed^sys_id!=' + obj.getUniqueValue());
                } else {
                    pAlert = this.verifyPrimaryExistence(matchingConfig.query.replace('^EQ', '') + '^correlation_group!=2^state!=Closed^sys_id!=' + obj.getUniqueValue());
                }
				
				
                this.printLog('processDumpsterRules() :: pAlert :: ' + JSON.stringify(pAlert));

                if (pAlert.status) {
                    result.primary = pAlert.sys_id;
                    result.secondary = obj.getUniqueValue();
                } else {
                    result.primary = obj.getUniqueValue();
                    result.secondary = '';
                }
                return result;
				
            } else if (count > matchingConfig.alert_count) {

                if (JSUtil.nil(ciFilter)) {
                    pAlert = this.verifyPrimaryExistence(matchingConfig.query.replace('^EQ', '') + '^cmdb_ci.' + ciFilter + '=' + obj.cmdb_ci.sys_class_name + '^correlation_group=1^state!=Closed^sys_id!=' + obj.getUniqueValue());
                } else {
                    pAlert = this.verifyPrimaryExistence(matchingConfig.query.replace('^EQ', '') + '^correlation_group=1^state!=Closed^sys_id!=' + obj.getUniqueValue());
                }

                this.printLog('processDumpsterRules() :: pAlert :: ' + JSON.stringify(pAlert));

                if (pAlert.status) {
                    result.primary = pAlert.sys_id;
                    result.secondary = obj.getUniqueValue();
                } else {
                    /*
                    var alertGr = new GlideRecord('em_alert');
                    if(JSUtil.nil(ciFilter)){
                    	alertGr.addEncodedQuery(matchingConfig.query+'^correlation_group!=2^state!=Closed^sys_id!='+obj.getUniqueValue());
                    }
                    else{
                    	alertGr.addEncodedQuery(matchingConfig.query+'^cmdb_ci.'+ciFilter+'='+obj.cmdb_ci.sys_class_name+'^correlation_group!=2^state!=Closed^sys_id!='+obj.getUniqueValue());
                    }
                    alertGr.orderByDesc('sys_created_on');
                    alertGr.setLimit(1);
                    alertGr.query();
                    if(alertGr.next()){
                    	result.primary = alertGr.getUniqueValue();
                    	result.secondary = obj.getUniqueValue();
                    }
                    */
                    result.primary = obj.getUniqueValue();
                    result.secondary = '';
                }
                return result;
            } else {
                result.primary = obj.getUniqueValue();
                result.secondary = '';
                return result;
            }
        } else {
            this.printLog('No macthing config found!');
        }
    },

    getMatchingConfig: function(alertId) {
        var config = [];
        var aacfConfigGr = new GlideRecord('u_advanced_alert_correlation_configuration');
        aacfConfigGr.addEncodedQuery('u_active=true');
        aacfConfigGr.orderBy('u_order');
        aacfConfigGr.query();
        while (aacfConfigGr.next()) {
            var obj = {};
            obj.query = String(aacfConfigGr.getValue('u_filter_condition'));
            obj.id = aacfConfigGr.getUniqueValue();
            obj.time_window = parseInt(aacfConfigGr.getValue('u_time_window'));
            obj.alert_count = parseInt(aacfConfigGr.getValue('u_number_of_alerts'));
            config.push(obj);
        }

        for (var i = 0; i < config.length; i++) {
            var alertGr = new GlideRecord('em_alert');
            alertGr.addEncodedQuery('sys_id=' + alertId + '^' + config[i]['query']);
            alertGr.query();
            if (alertGr.next()) {
                return config[i];
            }
        }

        return;
    },

    verifyPrimaryExistence: function(query) {
        this.printLog('verifyPrimaryExistence :: @param-query :: ' + query);
        var alertGr = new GlideRecord('em_alert');
        alertGr.orderByDesc('sys_created_on');
        alertGr.setLimit(1);
        alertGr.addEncodedQuery(query);
        alertGr.query();
        if (alertGr.next()) {
            return {
                status: true,
                sys_id: alertGr.getUniqueValue()
            };
        } else {
            return {
                status: false
            };
        }
    },

    printLog: function(msg) {
        if (msg) {
            gs.error('ITOM :: AACFUtils :: ' + msg);
        }
    },

    type: 'AACFUtils'
};