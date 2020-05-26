var obj = {
    "1":"Hello World",
    "3":"How are you?",
    "2":"This is Sudharsanana"
}

console.log(Array.isArray(Object.keys(obj).sort()));

console.log(JSON.parse(new ITSRTAutomationUtil().getProbeScript('EM Automation Loops','resourceLoopMapping'))[currentAlert.getValue('resource')]);